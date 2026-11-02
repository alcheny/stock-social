# Plan v2: F-16 trust and safety slice + F-17 handle and name integrity (one PR)

UX lead, 2026-11-01, **v2** (round 2: demands answered in §R2; every §12 question voted as recommended). Branch `claude/f16-f17-trust-safety` (from origin/main, F-9 = PR #65 `ff25ad5`, fix #4 = PR #59
`3f216ba`). Sources: `docs/features/F-16-trust-and-safety-slice.md` and `docs/features/F-17-handle-and-name-integrity.md`,
including the cycle-3 re-approvals and K18; `docs/POLICY.md`; `docs/COMPLIANCE.md` §1; `docs/IMPLEMENTATION.md` "The
cycle"; Next 16.4.3 docs in `node_modules/next/dist/docs/` (not-found, proxy). Every decision in both feature files is
planned below. Where I disagree or the build hits a stop, it is said in §0, not planned around.

## R2. Round 2 changes (v2)

Both reviewers voted the recommended option on every §12 question; those answers are now decisions of this plan.
Where §2–§12 still read otherwise, this section wins.

**Business lead**

| Demand | Answer | Where |
|---|---|---|
| B1 no `app/pane.tsx` edit | Accepted. `<TrustFoot inPane />` (line + F3 disclaimer) is mounted after `ProfilePane` at `app/feed-rows.tsx:35` and `app/lazy-pane.tsx:23`. e2e at 360 px finds both in an open pane; the diff has no `app/pane.tsx`. | §2.3, §4, §13 C |
| B2 own-view line for hidden theses | Accepted. `heldLine(HIDDEN_RULE)` = "This thesis is not shown to others right now. Only you can see it." Unit test: no `/report\|review/i`. db + e2e: the trader sees it. | §5.3, `lib/f16-static.test.ts`, `e2e/f16-pages` |
| B3 no `delete from` in `changeHandle` | Accepted. Taking back a hold sets `until = now()`; the purge removes it later. Source test + db test. | §6.1 step 10 |
| B4 hidden/retired 404s are `private, no-store` | Accepted. These 404s are dynamic (they read cookies and headers), and Next sends `private, no-cache, no-store` for dynamic responses. If the spike shows otherwise, `proxy.ts` sets the header on `/u/*` 404s. e2e: the trader's response, then a signed-out one, which lacks the private line; both are `no-store`. | §13 Step 0 |
| B5 ponytail wording | Accepted. The `attempts.ts:154` ponytail is replaced with "old links show the neutral retired page by design (F-17); nothing to add". | §6.1 |
| B6 signed-out menu | Accepted. This overrides §2.1/§2.2. The quiet menu shows signed out too and leads to the signed-out state: "Sign in to report this profile." plus the takedown link when it is reachable. Signed-out e2e added. | §2.1, §2.2 |
| B7 shorter line | Accepted. `TRUST_LINE.text` = `${PRODUCT_NAME} never messages anyone about a trading record. Anyone who contacts you elsewhere using this profile isn't acting for ${PRODUCT_NAME}.` e2e at 360 px: the line and the F3 disclaimer are in view together. | §5.4 |
| B8 Send report at 360×740 | Accepted. The e2e scrolls at most once; the button is ≥ 44 px and in the viewport. | §8 F-16 #15 |
| B9 axe AC unchecked | Accepted. The PR leaves that box unchecked until the owner answers. | §0.1 |

**Engineer**

| Demand | Answer | Where |
|---|---|---|
| E1 not-found metadata | Accepted (verified at `resolve-metadata.js:93-120`). `generateMetadata` lives in `app/u/[handle]/not-found.tsx`. No React `<title>`. Step 0 spike. | §11, §13 |
| E2 immutable `ImageResponse` | Accepted. `Cache-Control: public, max-age=300` on the three `u/[handle]` og images and `t/[symbol]/opengraph-image.tsx`, like `story/route.tsx:17`. A production-build e2e asserts the header. ponytail reworded: "bounded ≤ 300 s images, 60 s JSON". The owner accepts this reading (adds to Q13). | §9.1, §13 A |
| E3 | = B1 | |
| E4 `open_positions` reads | Accepted. The predicate goes on `page.tsx:87`, `record-card-data.ts:22`, `pane/route.ts:21`, `trade-share-load.ts:46`, `display-log.ts:51`, `feed.ts:460`. `lib/positions.ts:15,26` are allowlisted (sync write). The `thesis_reports` rule matches `\bthesis_reports\b` and allows `lib/privacy-retention.ts`. The scanner self-test includes `feed.ts:149,170`. | §5.2, §5.5 |
| E5 feed snapshot | Accepted. `visibleUserAsOf` treats a hide like a deletion as of `asOf`; `:399`/`:406` keep the current-time predicate (a gap, never a shift). | §5.1 |
| E6 unhide after clear | Accepted. Unhide follows the latest audit row and updates whatever row exists (or none). A db test runs hide → clear → unhide → a new note publishes. | §5.3 |
| E7 brand words | Accepted. Substring rules stay for brand words; word boundaries apply only to verified/official. | §6.3 |
| E8 `visibleId` | Accepted. Added; the scanner accepts it. | §5.1, §5.2 |
| E9 indexes | Accepted. Both dropped. | §3 |
| E10 lock order | Accepted. Look up the target, then take `pg_advisory_xact_lock`. | §5.5 step 3 |
| E11 own-account paths | Accepted. `record-tools.ts:247` export, `handles.ts:124`, `connections.ts:372`, `billing.ts:175` stay deletion-only. A db test checks that a hidden trader can sign in, use settings and download data. | §4 |
| E12 follows | Accepted. Only `lib/follows.ts:18` changes; private lists are untouched. This overrides the likes/follows rows in §4/§5.2: `lib/likes.ts` reads that are viewer-private join the allowlist with reason "viewer's own list". | §4, §5.2 |
| E13 `handleStatus` | Accepted. | §5.1, §3 |
| E14 rename tests | Accepted. `now` is injected through `opts`; `handles.db.test.ts:189-211` changes only for cap 1; `attempts.test.ts:93→101→105` gets two backdates. The count never drops. | §0.7 |
| E15 test files | Accepted. Static checks merge into `lib/f16-static.test.ts` (one named test per AC). The byte-equality image check is replaced by a db test of the counts the stock image reads. | §8 |
| E16 `getByLabel('New handle')` | Kept. The label becomes visible with the same text. | §2.6 |

No disagreements this round.

## 0. Stops and disagreements (read first)

1. **Hard stop: "axe e2e" (F-16 AC "Report form: axe e2e ...").** No axe package is installed (`package.json`,
   `node_modules`). Adding `@axe-core/playwright` is a new dependency (POLICY C2, H), and axe-core is MPL-2.0, which
   is not in `LICENSE_OK` (`scripts/compliance.ts:74`). It needs both an owner pre-authorization and a
   `LICENSE_REVIEWED` entry. Plan: build the same checks by hand in `e2e/f16-report-form.spec.ts` (§8, AC-F16-15).
   Mark them `ponytail:` naming axe as the next step, and file pre-authorization request "axe-core for e2e
   accessibility scans". The AC counts as met only when the owner accepts the substitute or authorizes the package.
2. **Disagreement, F-17 decision 1 vs existing code and tests: the vendor name in `RESERVED`.** `lib/handles.ts:16-25`
   reserves `snaptrade` (also `RESERVED_SUBSTRINGS`, `STAFF_WORDS`, `NAME_WORDS` brand), and `lib/handles.test.ts:16,
   62,78,106` assert it. The decision says "No third-party company, broker, platform or person name appears in the
   list, tests or fixtures". POLICY T1 allows integrated vendors to be named only "to describe that integration".
   Taking it out follows the decision. It also changes four existing assertions (CLAUDE.md: never weaken tests) and
   lets `snaptrade_support` through. F-17 Out of scope already sends "impersonation of named firms" to F-16's report
   and the owner's hide. **Recommendation (Q1): keep it** under T1's integrated-vendor exception. The AC test then
   checks the list against `MARKS` and the people list (non-integrated names), and the committee records this
   reading. If the owner reads the decision literally, removal is an owner-approved test change.
3. **Wording conflict: "A hold stores only the handle string and a release date" vs "the holder can rename back".**
   `handle_reservations` (`db/schema.sql:255`, `:678`) also holds `user_id` (on delete set null). Without it, nobody can
   tell the holder from a stranger. **Recommendation (Q2):** read "only" as "no personal data beyond the holding
   account's id, which deletion nulls". The AC test asserts that the columns are exactly
   `{handle, until, user_id}` and that the link is null after `deleteProfile`.
4. **"Look-alike checks run only against reserved, demo, connected and F-7 handles."** Today `checkHandle`
   (`lib/handles.ts:131-146`) compares the skeleton against every other account's handle, which is a superset.
   Narrowing it would break `lib/handles.db.test.ts:49,56`. **Recommendation (Q3): keep the superset** (it is stricter
   and weakens no test). F-7 handles are already users rows (`pf_…`), checked at runtime and never listed.
5. **F-17 AC "Display names: NFKC applied".** F-9 stores NFC and matches on NFKC (`lib/text-safety.ts` fix round 5:
   NFKC in storage would damage scripts). The plan keeps that and tests NFKC in matching: full-width "Ｖｅｒｉｆｉｅｄ"
   is refused. (Q4)
6. **There is no product-name constant** in `lib/copy.ts`. The name is a literal in `app/layout.tsx:13,34`,
   `lib/copy.ts:48,191,…`. The plan adds `PRODUCT_NAME` to `lib/copy.ts`, in the F-16 block, used by the new copy
   only. It also helps T5a: a future rename is one constant.
7. **Existing tests the decisions change** (the count never drops; the reviewer checks that each change maps to a
   decision):
   - `lib/handles.db.test.ts:191-211` asserts `RENAME_HOLD_CAP === 3` and "a fourth rename releases the oldest". F-17
     sets the cap to 1, so this test is rewritten to the one-hold rule.
   - `lib/auth/attempts.test.ts:93-105,131-150` renames one account several times in a row. The 30-day rule refuses
     the second rename, so a fixture step backdates `users.handle_renamed_at` between renames. No assertion changes.
   - `lib/fixes-cycle2-trust.test.ts:19` `PENDING_VISIBLE` becomes `[]`. Its own guard requires this once those files
     adopt the predicate. This strengthens the test.

## 1. What gets built (overview)

| Piece | Feature | Where |
|---|---|---|
| Hidden state in the one visible-user predicate | F-16 | `lib/visible-users.ts` (+ `users.hidden_at`) |
| Every public `closed_trades` / `open_positions` read on the predicate, a source test with an allowlist | F-16 | ~20 files, `lib/f16-visible-reads.test.ts` |
| Profile report (6 fixed categories incl. "Impersonating this trader elsewhere", "May be under 18") | F-16, K18 | `lib/reports.ts`, `lib/report-copy.ts`, `/u/[handle]/report` |
| Owner-run audited hide/unhide (profile or thesis only) | F-16 | `lib/trust-hide.ts`, `scripts/hide.ts`, `trust_audit` |
| Owner digest (script; under-18 first) + report resolve | F-16 | `lib/trust-digest.ts`, `scripts/trust-digest.ts` |
| Neutral 404 pages: hidden profile, old/retired handle | F-16, F-17 | `app/u/[handle]/not-found.tsx`, `proxy.ts` (1 line) |
| Anti-impersonation line (profile + pane), draft-gated | F-16 | `app/trust-foot.tsx`, `lib/copy.ts` |
| Takedown and notice page, draft-gated, role mailbox | F-16 | `app/takedown/page.tsx`, `lib/takedown.ts` |
| Runbook | F-16 | `docs/security/trust-and-safety-runbook.md` |
| One rename per 30 days, one hold, rename-back, D22 in `changeHandle` | F-17 | `lib/auth/attempts.ts`, `users.handle_renamed_at` |
| Display-name word rules on word boundaries; one-normaliser test; confusables set | F-17 | `lib/handles.ts`, tests |
| Rejection a11y on sign-up and rename (beside field, `aria-invalid`, `role=alert`, focus) | F-17 | `app/login/dev/page.tsx`, profile rename form |

Nothing here deletes data, sends email, adds a dependency or a cookie, or changes `lib/sync*.ts`, `lib/trades.ts`,
`lib/options*.ts`, `app/user-note.tsx`, `lib/user-note.ts`, `app/record-strip.tsx`, F-11's status line, F-26's note
slots or the TOKENS block of `app/globals.css`.

## 2. Screen flow and every state

### 2.1 Profile `/u/<handle>` (viewer's view)

| State | What renders | Status / head |
|---|---|---|
| Visible, signed out | Profile as today, then the F-16 block at the end of `<main>`: the anti-impersonation line (if shown, §5.4) and (v2 B6) the same quiet menu, leading to the report page's signed-out state. The site footer with the F3 disclaimer follows directly. | 200 as today |
| Visible, signed in, another trader (broker, demo or F-7 filer) | The same, plus a quiet "…" menu (`MoreMenu`, label "More for @handle", reused from `app/not-interested.tsx:27`) in the F-16 block with one item: the link "Report this profile" → `/u/<handle>/report`. Never in the header, never next to Follow (`page.tsx:236`) or the share prompt/card (`:256`, `:283`). | 200 |
| Own profile | No report menu. The line shows. The rename panel gets the 30-day hint (§2.6). | 200 |
| Demo profile | Like any other trader: the Demo badge as today, the report menu signed in, the line. | 200 |
| All losses / new trader / importing / failed | Unchanged by this PR. The F-16 block is the same in every record state. An importing record still shows the block (it holds no figures). | 200 |
| **Hidden** (any viewer but the trader) | Segment not-found UI, kind `hidden`: h1 "Profile not available", one line "This profile is not available right now.", links "Back to the feed" and "All stocks" (44 px, like `app/not-found.tsx`). No name, no figures, no badge, no record parts. | **404**, title "Profile not available · Stock Social", `noindex` (Next adds it on 404), no `og:image` |
| Hidden, the hidden trader signed in | The same notice, plus one private line (Q9): "Only you see this: your profile is not shown to others right now. Your settings and your data download still work." and a link to `/settings`. It never says reported or review. | 404 |
| **Retired handle** (held by a rename, reserved after a deletion, or deletion pending) | Kind `retired`: h1 "This handle is no longer in use", line "Links to this address no longer lead to a profile.", links back to the feed and all stocks. No profile content, no link to the new handle, no 301. | **404**, title "Handle no longer in use · Stock Social", noindex |
| Never used / junk | Today's generic 404 (`app/not-found.tsx` copy, reused). | 404 |

The same three kinds apply to every page under `/u/<handle>/**` that calls `notFound()`: the trade page, the month page
and the report page. The segment boundary `app/u/[handle]/not-found.tsx` is their parent.

### 2.2 Report page `/u/<handle>/report` (new)

| State | What renders |
|---|---|
| Signed out | h1 "Report this profile", "Sign in to report this profile.", link "Sign in" → `/login`. No form. 200, noindex. |
| Own profile | h1, "This is your profile, so you can't report it." and a link back. No form. |
| Already reported (a row exists for this reporter and target) | h1, a `role=status` "You already reported this profile." and a link back. No form. |
| Form (default) | h1 "Report this profile", sub-line "@handle" in `<bdi>`, then `<fieldset>` with `<legend>` "What is wrong with this profile?", six radios each with a visible `<label>`, and hint `#report-hint` "Choose one. The trader is never told who reported. A report alone does not hide or remove a profile." Button "Send report" (44 px), then link "Back to @handle". Below: "Something else, or a legal notice? Notices and takedown requests" (only when `takedownReachable()`). |
| Error: no category | `<p id="report-err" role="alert">` "Choose what is wrong with this profile." placed **between the legend and the first radio**. Every radio gets `aria-invalid="true"` and `aria-describedby="report-hint report-err"`. Focus moves to the first radio. |
| Error: rate (per reporter or per target, one wording for both so target volume never leaks) | `role=alert`, focusable (`tabIndex=-1`), takes focus: "Too many reports right now. Try again later." The form stays. |
| Error: failed (database) | `role=alert`, takes focus: "Could not send this report. Try again later." |
| Sent | The form is replaced by `<p role="status" tabIndex={-1}>` "Report sent. Thank you." It takes focus, then "Back to @handle". |
| Hidden / retired / unknown target | `notFound()`: the §2.1 kinds. |
| No JavaScript | The server action posts and the page re-renders with the same states (`useActionState` with a server action supports progressive enhancement). |

### 2.3 Pane (feed sheet, Similar rows)

Visible (v2, B1/E3): **no edit to `app/pane.tsx`**. `<TrustFoot inPane />` is mounted directly after the `ProfilePane` element at its two call sites: `app/feed-rows.tsx:35` (`<>{ProfilePane(...)}<TrustFoot inPane /></>`) and `app/lazy-pane.tsx:23`. It renders the anti-impersonation line and directly under it the F3 disclaimer
(`DISCLAIMER`, `lib/share.ts:16`), because the pane has no disclaimer of its own and the line must never stand without
it. No report control in the pane: reporting is on the profile ("See full profile →" is already there). Hidden traders
never reach a pane: the pane route returns 404 and the feed drops their cards.

### 2.4 Takedown page `/takedown` (new)

| Deploy | Renders |
|---|---|
| Sandbox (e2e, dev) while the wording is draft | The page with a `role=note` banner "Draft: this wording has not been approved yet." |
| Closed or open gate while draft | `notFound()` (generic 404). Closed admits allowlisted real accounts, so it counts as admitting real users. |
| Approved (`TAKEDOWN.approved = true`, flipped by the owner) and `TAKEDOWN_CONTACT` set | The page without the banner. |
| Contact unset | Sandbox: the line "The contact address is not set yet." Outside the sandbox: not reachable (`takedownReachable` needs the contact). |

### 2.5 Owner digest (terminal)

`node --env-file=.env scripts/trust-digest.ts` prints counts and links, **under-18 first** (§5.6). No page.

### 2.6 Rename (profile, owner only) and dev sign-up

| State | Renders |
|---|---|
| Panel closed | "Change handle" button as today. |
| Panel open | Field "New handle" (visible label, not only `sr-only`, Q11), hint `#handle-hint` = `HANDLE_RULE` plus the new `PROFILE.renameRule`: "You can change your handle once every 30 days. Your old handle stays reserved for you for a year and its links stop working. Changing again releases it." |
| Rejected (taken / reserved / lookalike / format / **soon**) | The panel is open. `<p id="handle-err" role="alert">` **directly after the input** (moved above the hint). The input gets `aria-invalid="true"`, `aria-describedby="handle-err handle-hint"` and `autoFocus`. `soon`: "You can change your handle once every 30 days. Next change: Dec 1, 2026." |
| Accepted | Redirect to the new handle as today. The old URL now shows the §2.1 `retired` page. |
| Dev sign-up (`/login/dev`) rejection | The alert moves from the top of the page (`page.tsx:27`) to directly under the field it names (handle, name or 18+ box), with `aria-invalid` on that field. The stray `sp?.error === 'handle'` line (`:31`) is removed (it is unreachable: `signInErrorText` maps codes). |

## 3. Data model (`db/schema.sql`, appended block `-- ---- F-16 / F-17 ... ----`, idempotent)

```sql
-- ---- F-16 (docs/features/F-16-trust-and-safety-slice.md) and F-17 (F-17-handle-and-name-integrity.md) ----
-- Hidden by the owner's audited script (lib/trust-hide.ts). Never set by a report. The visible-user predicate
-- (lib/visible-users.ts) skips it on every public read. Cleared by unhide. Nothing is deleted.
-- Not public_filers.hidden_at (F-7's filer switch): this is the owner's trust-and-safety hide of any account.
select schema_add_column('users', 'hidden_at', 'timestamptz');
-- F-17: when this account last changed its handle (a counted rename), for the one-change-per-30-days rule.
select schema_add_column('users', 'handle_renamed_at', 'timestamptz');
-- One reports table (F-9's): a profile report is a row with target 'profile' and sell_id ''. The existing
-- unique (reporter_id, trader_id, sell_id) then allows one report per reporter per profile, ever. target, category
-- and resolution have no CHECK (widening a CHECK needs a drop, which CI forbids; precedent: the F-15 block):
-- lib/reports.ts validates them against REPORT_TARGETS, REPORT_CATEGORIES and RESOLUTIONS.
select schema_add_column('thesis_reports', 'target', $d$text not null default 'thesis'$d$);
select schema_add_column('thesis_reports', 'category', 'text');          -- null on thesis reports
select schema_add_column('thesis_reports', 'resolved_at', 'timestamptz'); -- set by the owner's digest script
select schema_add_column('thesis_reports', 'resolution', 'text');         -- 'founded' | 'unfounded'
-- v2 (E9): no new index; thesis_reports_note (trader_id, sell_id, created_at) and the unique key cover the queries.
-- Every hide and unhide, written in the same transaction as the change. No thesis text, no reporter.
create table if not exists trust_audit (
  id bigint generated always as identity primary key,
  kind text not null,                                   -- 'profile' | 'thesis' (lib/trust-hide.ts HIDE_KINDS)
  user_id int not null references users on delete cascade,
  sell_id text,                                         -- the thesis's closing sell; null for a profile
  action text not null check (action in ('hide', 'unhide')),
  reason text not null,                                 -- lib/trust-hide.ts HIDE_REASONS / UNHIDE_REASONS
  actor text not null,                                  -- 'owner' (the only actor until real admin identity)
  at timestamptz not null default now()
);
select schema_add_index('trust_audit_item', 'create index trust_audit_item on trust_audit (user_id, kind, sell_id, at desc)');
```

No `drop`, `truncate` or `delete from` (CI guard). The `(target='profile') = (sell_id='')` rule is enforced in
`reportProfile`, and a db test checks it on every row. A table constraint would need a `do $$ … pg_constraint` guard,
and none exists yet in the file. Q5 asks whether to add one.

**Privacy maps (additive):**
- `lib/privacy-retention.ts` `SCHEMA_MAP`:
  - add `trust_audit: { personal: true, retention: 'account', holds: 'owner hides and unhides of a profile or thesis: kind, user id, sell id, action, reason code, actor, time; no thesis text or reporter; deleted with the profile (cascade)' }`.
  - update `thesis_reports.holds`: "which signed-in reader reported which trader's note (by sell id) or profile (sell id empty), the fixed category, when, and the owner's resolution".
  - update `handle_reservations.holds`: "at most 1 per account" in place of 3.
  - update `users.holds`: add "hidden state, last handle change".
- `lib/privacy-fields.ts`: no change (no column added to a publicly read record table; `thesis_hold_rule` gains a value,
  not a column). `lib/privacy-fields.test.ts` stays green.
- `lib/privacy-cookies.ts`: no change (no cookie). `lib/privacy-cookies.test.ts` proves it.
- `lib/privacy-purge.ts`: no change (reports and audit rows live as long as the account).

**Thesis hide state.** No column. A hidden thesis is `thesis_status='held'`, `thesis_hold_rule='hidden'`
(`HIDDEN_RULE`, new in `lib/report-copy.ts` beside `KEPT_RULE`). `lib/sync.ts:91` already carries `thesis_hold_rule`
through `rebuildTrades`, so the hide survives a rebuild without editing sync. The audit's latest row per thesis
is the source of truth for re-saves (§5.3).

## 4. Files (new vs edited, owners respected)

**New (this PR owns them):**
- `lib/trust-hide.ts`: `hideProfile`, `unhideProfile`, `hideThesis`, `unhideThesis`, `thesisHiddenByOwner`, `HIDE_KINDS`,
  `HIDE_REASONS`, `UNHIDE_REASONS`, `HideDeps`.
- `lib/trust-digest.ts`: `digest()` (counts and handles), `resolveReport()`, `repeatUnfounded()`.
- `lib/takedown.ts`: `takedownReachable(env)`, `impersonationLineShown(env)` (both on `gateState`/`isSandbox` from
  `lib/launch-gate.ts`, read-only use).
- `scripts/hide.ts`, `scripts/trust-digest.ts`: CLIs with testable `run(argv, out)` (the `scripts/review-theses.ts`
  pattern).
- `app/u/[handle]/not-found.tsx`: the three kinds (hidden / retired / generic).
- `app/u/[handle]/report/page.tsx` and `app/u/[handle]/report/report-form.tsx` (client island).
- `app/report-actions.ts` (`'use server'`, `reportProfileAction`). This keeps `app/actions.ts` (F-25/fix #27 overlap)
  untouched.
- `app/trust-foot.tsx`: `TrustFoot` (line + optional disclaimer) and `ProfileReportMenu`.
- `app/takedown/page.tsx`.
- `docs/security/trust-and-safety-runbook.md`.
- Tests: `lib/f16-visible-reads.test.ts`, `lib/f16-visible.db.test.ts`, `lib/f16-reports.test.ts`,
  `lib/f16-reports.db.test.ts`, `lib/f16-hide.db.test.ts`, `lib/f16-hide-script.test.ts`, `lib/f16-digest.db.test.ts`,
  `lib/f16-copy.test.ts`, `lib/f16-takedown.test.ts`, `lib/f16-runbook.test.ts`, `lib/f16-no-email.test.ts`,
  `lib/f16-images.test.ts`, `lib/f17-handles.test.ts`, `lib/f17-rename.db.test.ts`, `lib/f17-normaliser.test.ts`,
  `lib/f17-logs.test.ts`, `e2e/f16-hide.spec.ts`, `e2e/f16-report-form.spec.ts`, `e2e/f16-pages.spec.ts`,
  `e2e/f17-handles.spec.ts`.

**Edited (additive, F-16/F-17 named block or minimal swap):**

| File | Change | Owner / coordination |
|---|---|---|
| `lib/visible-users.ts` | add `hidden_at is null`; `visibleUserAsOf`, `visibleOwner`, `handleStatus`; `isVisibleUser` takes optional `hidden_at` | fix #4 (said F-16 extends it) |
| `lib/reports.ts` | `reportProfile`, `PROFILE_*` limits, `REPORT_TARGETS`, `RESOLUTIONS`; thesis lookup `:34-35` → `visibleUser('u')` | F-9 (merged) |
| `lib/report-copy.ts` | `PROFILE_REPORT_COPY`, `REPORT_CATEGORIES`, `HIDDEN_RULE`; `heldLine('hidden')` = kept wording | F-9 |
| `lib/thesis-save.ts` | a hidden thesis stays held through edit, clear and rewrite (§5.3) | F-9 |
| `lib/thesis-review.ts` | `releaseThesis` skips `thesis_hold_rule = 'hidden'` (no unaudited unhide) | F-9 |
| `lib/handles.ts` | word-boundary `NAME_WORDS`; `HANDLE_REASON.soon`; `profileHandleError` knows `soon` | F-9 / F-17 |
| `lib/auth/attempts.ts#changeHandle` | `RENAME_HOLD_CAP = 1`, 30-day rule, rename-back, D22 check (§6) | F-17 (was #42, F-7 merged) |
| `app/auth/actions.ts#setHandle` | maps the `soon` verdict (keeps its D22 pre-check) | F-17 |
| `app/u/[handle]/page.tsx` | `load()`: `handleStatus` → `notFound()` for hidden/retired; closed_trades read + `visibleOwner`; `generateMetadata` titles for hidden/retired; the F-16 block at the end of `<main>`; rename form a11y + hint | shared with F-11, F-22, F-26: no edit near the status line or note slots |
| `app/feed-rows.tsx:35`, `app/lazy-pane.tsx:23` | mount `<TrustFoot inPane />` after `ProfilePane` (v2 B1; `app/pane.tsx` untouched) | additive |
| `app/login/dev/page.tsx` | error beside its field, `aria-invalid` | F-17 |
| `proxy.ts` | one line: `requestHeaders.set('x-ss-path', request.nextUrl.pathname)` | security hardening (merged): coordination note |
| `app/u/[handle]/pane/route.ts`, `pane-chart/route.ts`, `record-card-data.ts`, `lib/recap-load.ts`, `lib/trade-share-load.ts` | user lookup `deleted_at is null` → `visibleUser('u')`; closed_trades reads + `visibleOwner` | F-4/F-12 files, predicate-only |
| `app/t/compare/page.tsx`, `app/t/[symbol]/opengraph-image.tsx`, `app/t/open-positions.ts` | onto the predicate (clears `PENDING_VISIBLE`) | F-6/F-12 files, predicate-only |
| `lib/feed.ts` `:148`, `:207`, `:250`, `:399`, `:406` | predicate in the join and where conditions only, not the note columns | F-21/F-23/F-26: predicate-only, coordination note |
| `lib/similar.ts:64`, `lib/likes.ts` (`:18,54,75-77,110,123-124,149,160,164`), `lib/follows.ts` (6 lookups), `lib/record-tools.ts:206` (+4 lookups), `lib/display-log.ts:50,83`, `lib/discovery/activity.ts:63-64,87`, `lib/discovery/personal-load.ts:36`, `lib/home-preview.ts:28` | `u.deleted_at is null` → `visibleUser('u')`, or `+ visibleOwner(...)` | F-2/F-3/F-15/privacy, merged: predicate-only |
| `lib/fixes-cycle2-trust.test.ts:19` | `PENDING_VISIBLE = []` | strengthening |
| `lib/privacy-retention.ts` | SCHEMA_MAP rows (§3) | privacy groundwork: additive |
| `lib/copy.ts` | F-16/F-17 block: `PRODUCT_NAME`, `TRUST_LINE`, `HIDDEN_NOTICE`, `RETIRED_NOTICE`, `TAKEDOWN`, `PROFILE.renameRule`/`renameSoon`. Add them to the copy-scan list (`:738`). | shared: additive block |
| `app/globals.css` | block `/* ---- F-16 / F-17 ---- */`: `.trust-foot`, `.report-form fieldset`, `.report-choice` (44 px rows), `.draft-banner`. Existing tokens only, nothing in TOKENS | F-20: no token edits |
| `.env.example` | `TAKEDOWN_CONTACT=` with a comment ("a role mailbox, never a personal address") | additive |
| `docs/features/logs/coordination-2026-11-01.md` | one F-16/F-17 note (§11) | |

**Not edited (allowlisted in the read test instead):** `lib/sync*.ts`, `lib/trades.ts`, `lib/options*.ts` (#64),
`app/user-note.tsx`, `lib/user-note.ts`, `app/record-strip.tsx`, `lib/views.ts` (its `visible` binding at `:110` already
calls `visibleUser('u')`, so it picks up the hide).

## 5. F-16 behaviour in detail

### 5.1 The predicate (`lib/visible-users.ts`)

```ts
export const visibleUser = (a: string) => sql`(${sql(a)}.deleted_at is null and ${sql(a)}.hidden_at is null)`;
// The feed's snapshot form (lib/feed.ts:147-148, v2 E5): a hide counts from its time like a deletion; the card read
// (:399) and the people read (:406) keep visibleUser, so a hidden card is a gap and pages never shift.
export const visibleUserAsOf = (a: string, asOf: Date | null) => asOf
  ? sql`((${sql(a)}.deleted_at is null or ${sql(a)}.deleted_at > ${asOf}) and (${sql(a)}.hidden_at is null or ${sql(a)}.hidden_at > ${asOf}))` : visibleUser(a);
// v2 (E8): uncorrelated form for single-trader reads: `where user_id = ${id} and ${visibleId(id)}`.
export const visibleId = (id: number) => sql`exists (select 1 from users v where v.id = ${id} and ${visibleUser('v')})`;
export const visibleUserIds = () => sql`select v.id from users v where ${visibleUser('v')}`;
// For reads that don't join users (profile-scoped reads, aggregates): `where user_id = ${id} and ${visibleOwner('closed_trades')}`.
export const visibleOwner = (alias: string, col = 'user_id') => sql`exists (select 1 from users v where v.id = ${sql(alias)}.${sql(col)} and ${visibleUser('v')})`;
export const isVisibleUser = (u: { deleted_at: Date | null; hidden_at?: Date | null }) => u.deleted_at === null && !u.hidden_at;
// The /u/<handle> route's one lookup: what to render for a handle.
export async function handleStatus(handle: string): Promise<'visible' | 'hidden' | 'retired' | 'none'>
```
`handleStatus` (v2 E13: runs `routeHandle` first; a `pf_` filer handle → `none`) returns:
- `visible` / `hidden`: a live users row with that handle (deleted_at null).
- `retired`: no live row, but an active `handle_reservations` row (`until > now()`) or a row with `deleted_at` set.
- `none`: anything else.

F-7's `filerVisibleSql` stays a separate, additional condition (unchanged). A hidden F-7 filer stays its own state
(`public_filers.hidden_at`) and gets today's generic 404.

### 5.2 Every public read on the predicate: the AC test (`lib/f16-visible-reads.test.ts`)

**Scanner.** It walks `app/**/*.{ts,tsx}` and `lib/**/*.ts` (not `*.test.ts`, not `*.spec.ts`). A small tokenizer
collects every **top-level tagged template** whose tag is `sql`, `tx`, `db` or `conn` (optionally `sql<…>`), with its
nested `${…}` templates included. The current `/sql`([^`]*)`/` in `fixes-cycle2-trust.test.ts` stops at the first
nested backtick, so it is not enough. A statement **reads** when it matches `/\b(from|join) (closed_trades|open_positions)\b/`.
Each reading statement must match `/\$\{visible(User(AsOf)?\(|UserIds\(\)|Owner\(|Id\()/`, unless the file is in the
allowlist. Each allowlist entry is `{ file, count, reason, proof? }`:
- The test fails when a file has more unpredicated reads than `count`, or fewer (so the list shrinks when code
  improves).
- An allowlisted file that no longer exists fails.
- `proof` is a regex the file must still match (for example `lib/views.ts` must keep `const visible = sql\`${visibleUser('u')}`).
- It also asserts at least 40 reading statements were found, so the scanner can't silently match nothing.

**Public reads that adopt the predicate:**

| Surface | Reads |
|---|---|
| Feed `/` | `lib/feed.ts:137-180` (elig: `visibleUserAsOf('u', asOf)`), `:207`, `:250`, `:399`, `:406` |
| `/t` | `app/t/page.tsx:28,68` (already) |
| `/t/<SYM>` | `app/t/[symbol]/page.tsx:40,100,110,122` (already); `app/t/open-positions.ts:17` |
| `/t/compare` | `app/t/compare/page.tsx:23` |
| Stock image | `app/t/[symbol]/opengraph-image.tsx:32` |
| Profile page | `app/u/[handle]/page.tsx:64,72` |
| Profile og image + story | `app/u/[handle]/record-card-data.ts:15,17` (covers `opengraph-image.tsx` and `story/route.tsx`) |
| Trade page/og | `lib/trade-share-load.ts:20,23` |
| Month page/og | `lib/recap-load.ts:14,16` |
| Pane JSON | `app/u/[handle]/pane/route.ts:17` (+ `records()` in feed) |
| Pane chart JSON | `app/u/[handle]/pane-chart/route.ts:15,19` |
| Sitemaps | `lib/sitemaps.ts:34` (already) |
| Similar | `lib/similar.ts:58-64` |
| Likes, hidden-trade lists, like targets | `lib/likes.ts` (all) |
| Record tools compare | `lib/record-tools.ts:206` |
| Display log (public-evidence log) | `lib/display-log.ts:50,83` |
| Activity logging targets and inputs | `lib/discovery/activity.ts:63,87` |
| Thesis report lookup | `lib/reports.ts:34` |

**Allowlist (owner-scoped, owner tooling, or writes; reason in the entry):**

| File | Why |
|---|---|
| `app/actions.ts:163` | the signed-in trader's own trade (ownership check) |
| `app/layout.tsx:22` | the viewer's own publisher flag (F-13 file) |
| `app/me/record/page.tsx:24` | the trader's own record (private; a hidden trader still sees it) |
| `lib/auth/landing.ts:15` | the trader's own count after sign-in |
| `lib/connections.ts:618,665` | the trader's own import counts (funnel, status) |
| `lib/delete.ts:79` | the account's own deletion screen |
| `lib/thesis-save.ts:34,64` | the trader's own note write |
| `lib/thesis-review.ts:47,50,63` | owner review (script and flag-gated page), not public; hidden profiles' notes stay reviewable |
| `lib/privacy-purge.ts` (all) | the tick's purge (writes, no output) |
| `lib/public-trades.ts:101` | F-7 import rebuild (write) |
| `lib/sync.ts`, `lib/sync-*.ts`, `lib/options-sync.ts`, `lib/options*.ts`, `lib/trades.ts` | rebuild and sync (writes; other sessions own these: #64) |
| `lib/thesis-fixtures.ts` | test fixture helper |
| `lib/trust-hide.ts`, `lib/trust-digest.ts` | owner scripts: they must see hidden rows |
| `lib/views.ts` | `proof`: its `visible` binding calls `visibleUser('u')` (F-15 file, unchanged) |

### 5.3 Hide and unhide (`lib/trust-hide.ts`, `scripts/hide.ts`)

```
node --env-file=.env scripts/hide.ts profile <user_id> <reason>
node --env-file=.env scripts/hide.ts thesis <user_id> <sell_id> <reason>
node --env-file=.env scripts/hide.ts unhide-profile <user_id> <unhide-reason>
node --env-file=.env scripts/hide.ts unhide-thesis <user_id> <sell_id> <unhide-reason>
node --env-file=.env scripts/hide.ts history <user_id>
```
- **Kinds.** `HIDE_KINDS = ['profile', 'thesis']`. Any other first word (`trade`, `card`, `month`, a sell id alone…) prints
  "Only a whole profile or a thesis can be hidden; a single trade is never hidden." and exits 2. `hideItem(kind, …)`
  in the library throws `RefusedKind` for any other kind (a typed API and a runtime check).
- **Reasons.** `HIDE_REASONS = ['impersonation-elsewhere', 'pretends-to-be-someone', 'may-be-under-18',
  'money-or-paid-access', 'abusive', 'personal-information', 'legal-notice']` and `UNHIDE_REASONS = ['report-unfounded',
  'issue-resolved', 'hidden-by-mistake']`. Anything else exits 2 and nothing is written.
- **Profile hide.** One `sql.begin`:
  1. `update users set hidden_at = now() where id = $1 and hidden_at is null and deleted_at is null returning 1`.
     None returned: "Not hidden: no such visible profile." and exit 1.
  2. `deps.audit(tx, {kind, user_id, sell_id: null, action: 'hide', reason, actor: 'owner'})`.

  The audit insert throwing rolls back the hide (a db test injects a throwing `deps.audit`).
- **Profile unhide.** Same shape: `hidden_at = null where hidden_at is not null`, plus the audit row.
- **Thesis hide.** One transaction:
  1. `update closed_trades set thesis_status='held', thesis_hold_rule='hidden' where user_id and sell_id and thesis_status='published' returning 1`
     (and the same on `kept_theses`).
  2. The audit row.

  A thesis that is not published is refused: "No published thesis with that user id and sell id."
- **Thesis unhide** (v2 E6: allowed when the latest audit row is a `hide`; it updates whatever row exists, and with
  none, the audit row alone ends the hide). Sets `thesis_status='published', thesis_hold_rule=null, thesis_reviewed_at=now(),
  thesis_reports_from=now()`, only where `thesis_hold_rule='hidden'`, plus the audit row.
- **Own-view line** (v2 B2): `heldLine(HIDDEN_RULE)` = "This thesis is not shown to others right now. Only you can see
  it."
- **Holds survive the trader's own edits.** `lib/thesis-save.ts` keeps a note held with rule `hidden` when
  `prev.thesis_hold_rule === HIDDEN_RULE` **or** `thesisHiddenByOwner(tx, userId, sellId)` (the latest `trust_audit`
  row for that thesis is a `hide`). This closes the clear-and-rewrite escape that `kept` still has (`thesis-save.ts:52-53`).
- **No unaudited unhide.** `releaseThesis` (`lib/thesis-review.ts:22-34`) adds `and thesis_hold_rule is distinct from
  'hidden'` to both updates, so `review-theses.ts publish` can't unhide without an audit row. `listHeld` still lists the
  note with `rule: hidden`.
- **Never deletes.** No `delete`, no import of `lib/delete.ts`, no update of `closed_trades` other than the two thesis
  columns, no write to `activities`. The audit row holds no thesis text.
- **Owner-run only.** No route, action or page calls these functions (source test). That, and kinds limited to whole
  profiles and theses, is what keeps a hide from being used to hide a trader's own losses.

### 5.4 Anti-impersonation line

`lib/copy.ts` (F-16 block):

```ts
export const PRODUCT_NAME = 'Stock Social';
export const TRUST_LINE = {
  approved: false, // the owner flips this after approving the wording (F-16 Open questions)
  text: `${PRODUCT_NAME} never messages anyone about a trading record. Anyone who contacts you elsewhere using this profile isn't acting for ${PRODUCT_NAME}.`, // v2 B7
} as const;
```
- **Literally true** while F3b bars record-based messages. The only email the product sends is the sign-in link
  (`lib/copy.ts:420`, no record field).
- Names no platform, says nothing about identity or verification, plain text (no logo).
- **Shown** when `impersonationLineShown(env)` = `TRUST_LINE.approved || gateState(env) === 'sandbox'`.
- **Placement.** On the profile it is the last element of `<main>`, so the site footer's F3 disclaimer
  (`app/layout.tsx:42-44`) sits directly beside it. In the pane it renders with the disclaimer under it (§2.3).
- **Styling.** Normal body size (`.trust-foot { font-size: inherit }`, never smaller than the disclaimer), muted
  colour token as text (contrast ≥ 4.5:1, checked by the existing contrast test's token pairs).
- **Never** on the record card, link preview, story or any image: `TrustFoot` is a React component that no image file
  imports (test).

### 5.5 Profile reports (`lib/reports.ts#reportProfile`)

`reportProfile(reporterId, handle, category, deps = defaultReportDeps): Promise<ProfileReportOutcome>` with outcomes
`'reported' | 'signed-out' | 'invalid' | 'not-found' | 'own' | 'already' | 'rate'`. Order of checks:
1. No reporter → `signed-out`.
2. `normalizeHandle` fails or the category is not in `REPORT_CATEGORIES` → `invalid`.
3. `sql.begin`: look up the target with `visibleUser('u')` → `not-found`, then take
   `pg_advisory_xact_lock(hashtext('report-target:' || trader_id))` (v2 E10).
4. Target is the reporter → `own`.
5. A row exists for (reporter, trader, `''`) → `already`. One per reporter and target, ever. This satisfies both
   "report one profile once" and "one open report" (Q6).
6. Per reporter, either of:
   - a report of any target in the last `REPORT_INTERVAL_MS` (the F-9 query, now across targets);
   - the shared limiter `hit(limitKey('report-profile', id), PROFILE_REPORTS_PER_DAY = 5, 86_400)`.

   Either → `rate`.
7. Per target: `count(*) where target='profile' and trader_id and created_at > now() - 1 hour` ≥
   `PROFILE_REPORTS_PER_TARGET_HOUR = 10` → `rate`.
8. Insert `(reporter_id, trader_id, sell_id '', target 'profile', category)`. The `deps.allow` slot is spent after
   the insert (F-9's order).
9. `reported`.

It **never** updates `users`, `closed_trades` or anything else: no N-reporter auto-hold on profiles. F-9's
`REPORT_HOLD_AT` stays thesis-only. Nothing logs. Only `deps` and the database are touched.

`REPORT_CATEGORIES` (in `lib/report-copy.ts`, client-safe, order = form order):

| code | label |
|---|---|
| `impersonation-elsewhere` | Impersonating this trader elsewhere |
| `pretends-to-be-someone` | Pretends to be another person or a company |
| `may-be-under-18` | May be under 18 |
| `money-or-paid-access` | Asks for money or offers a paid service |
| `abusive` | Abusive or hateful name or note |
| `personal-information` | Shares someone's personal information |

The list is fixed and factual. It names no platform, does not judge skill or the record ("fake", "bad trader" are
absent), uses no age-group words, has no free-text field and no "other" box (P3: the form asks for no more than the
report needs; free text would need moderation of its own). Other problems go to the takedown page.

`PROFILE_REPORT_COPY` (in `lib/report-copy.ts`):
- `menu: 'Report this profile'`
- `title: (h) => \`Report @${h}\``
- `h1: 'Report this profile'`
- `legend: 'What is wrong with this profile?'`
- `hint: 'Choose one. The trader is never told who reported. A report alone does not hide or remove a profile.'`
- `submit: 'Send report'`
- `noCategory: 'Choose what is wrong with this profile.'`
- `rate: 'Too many reports right now. Try again later.'`
- `failed: 'Could not send this report. Try again later.'`
- `done: 'Report sent. Thank you.'`
- `already: 'You already reported this profile.'`
- `own: 'This is your profile, so you can\'t report it.'`
- `signedOut: 'Sign in to report this profile.'`
- `signIn: 'Sign in'`
- `back: (h) => \`Back to @${h}\``
- `other: 'Something else, or a legal notice?'`

**Reporter identity** is never selected by any trader-facing query. A source test asserts that `thesis_reports` appears
only in `lib/reports.ts`, `lib/thesis-review.ts` (counts), `lib/thesis-save.ts` (counts), `lib/trust-digest.ts`
(owner) and `db/schema.sql`. `exportFor` (`lib/record-tools.ts:245`) is unchanged and never reads it.

F-7 public profiles: the same action (target = the filer's users row), not settling F-7's T2 question.

### 5.6 Owner digest (`scripts/trust-digest.ts`; **recommended over a flag-gated page**, Q7)

A script needs no session, so the dev-stub question can't arise. It adds no route to gate or test for 404, and the
owner already runs `scripts/review-theses.ts` the same way. The page option would need its own title, one h1 and a
404 test, and gives the owner nothing more.

```
node --env-file=.env scripts/trust-digest.ts            # the digest
node --env-file=.env scripts/trust-digest.ts reports <trader_id>
node --env-file=.env scripts/trust-digest.ts resolve <reporter_id> <trader_id> founded|unfounded
node --env-file=.env scripts/trust-digest.ts reporters  # reporter ids with 2+ unfounded (owner terminal only)
```
Digest output (counts and links; nothing goes to a server log):
```
Open profile reports: 7 on 3 profiles
  May be under 18: 1 — <site>/u/<handle> (1)
  Impersonating this trader elsewhere: 4 — <site>/u/<a> (3), <site>/u/<b> (1)
  … (other categories, fixed order)
Held theses: 5 (scripts/review-theses.ts list)
Hidden: 1 profile, 2 theses (scripts/hide.ts history <user_id>)
Reporters with 2 or more unfounded reports: 0
Last sync tick: 2026-11-01T12:05:00Z (0.1 h ago); stopped at deadline: no
```
- "May be under 18" is always the first group, even at 0.
- Last tick = `max(heartbeat_at)` from `sync_shards` (the read `lib/health.ts#readHealth` uses, imported read-only).
  `stoppedAtDeadline` is any shard's `last_run->>'stoppedAtDeadline'`.
- The site is `siteUrl(process.env)` (`lib/ticker.ts`).
- Never reads `lib/session.ts` (source test). No email: there is no sender and no template.

### 5.7 Takedown page (`app/takedown/page.tsx`, `lib/copy.ts` `TAKEDOWN`)

- Metadata title: `Notices and takedown requests · Stock Social`, `robots: noindex` while draft.
- `export const dynamic = 'force-dynamic'` (env read per request).
- If `!takedownReachable(process.env)`, call `notFound()`.

`TAKEDOWN` copy:
- `approved: false`
- `draft: 'Draft: this wording has not been approved yet.'`
- `h1: 'Notices and takedown requests'`
- `lines`:
  - 'Use this page to tell us about something on Stock Social that you believe infringes your copyright, impersonates you or someone else, shares personal information or breaks the law.'
  - 'Signed in? Use "Report this profile" on the profile instead.'
  - 'Include the page address, what is wrong and how we can reply. For a copyright notice, say which of your works it uses.'
  - 'Sending a notice does not remove anything by itself. A person reads each one.'
- `contactTitle: 'Where to send it'`
- `unset: 'The contact address is not set yet.'`

The contact comes from env `TAKEDOWN_CONTACT` only, rendered as a `mailto:` like `app/public-records/page.tsx:17`.
There is no safe-harbor wording, no "designated agent", no statute section and no response time. A test forbids
`/safe harbou?r|designated agent|\b512\b|within \d+ (hours?|days?)|business days?/i`.

### 5.8 Runbook (`docs/security/trust-and-safety-runbook.md`)

Sections:
1. **Handling a report:** read the digest; under-18 first; check the profile; decide.
2. **Hide and unhide:** the exact `scripts/hide.ts` commands and the reason codes. Note that cached images and JSON can
   live up to 300 s at a CDN or browser (§9 ponytail): wait, or purge the deploy's cache for `/u/<handle>/*`.
3. **Under-18 reports (K18):** the owner reviews. A hide is allowed while the owner decides. No date of birth, ID or
   age estimation is asked for. Any account deletion is the owner's own decision through the account-deletion path,
   never automatic and never an agent's.
4. **Resolving reports and repeat unfounded reporters.**
5. **Restore from a backup, with deletion replay (owner only):** after a restore, every account deleted after the
   backup's time must be deleted again. The handles reserved by a deletion with `until − 365 days` later than the
   backup time name those accounts. The owner reruns the account-deletion path for each one. Written as an owner
   procedure; no agent step and no SQL that deletes.
6. **Breach notice, items to check (not settled law):**
   - FTC Safeguards Rule: notice to the FTC within 30 days of discovery when 500 or more consumers' unencrypted
     information is involved.
   - State breach-notification timelines (some 30 days).
   - Who to notify; what the notice holds.
   - First step from POLICY "If something leaks": rotate credentials.
7. **What this runbook never does:** no secrets, no personal addresses, no instruction to an agent to delete data.

## 6. F-17 behaviour in detail

### 6.1 `changeHandle(userId, raw, opts = { env: process.env, now: new Date() })` (`lib/auth/attempts.ts:157-189`)

In the existing single transaction, in this order:
1. Format.
2. Filer prefix.
3. **D22 here too:** `handleReserved(handle, env)` → `HandleTakenError('reserved')`. The check moves under every
   path; `setHandle` keeps its pre-check.
4. `select handle, handle_renamed_at from users … for update`.
5. Same handle → no-op.
6. **Rename-back:** the target is this account's own active hold (`handle_reservations.user_id = me and until > now`).
   It is allowed at any time and does **not** move `handle_renamed_at` (Q8).
7. **30-day rule:** otherwise, if `handle_renamed_at > now - 30 days` → `HandleTakenError('soon')`.
8. Lock the skeleton, `checkHandle`, update.
9. Hold the old handle (`until = now + 365 d`, `user_id = me`).
10. Release the taken-back hold with `update handle_reservations set until = now()` (v2 B3: the existing
    `delete from` at `lib/auth/attempts.ts:180` goes; a source test checks `changeHandle` has no `delete from`).
11. `RENAME_HOLD_CAP = 1`: every other active hold of this account gets `until = now()`. The purge removes it later, so
    nothing is deleted here.
12. Set `handle_renamed_at = now()`, **except** when the old handle is the account's untouched provisional handle
    (`/^trader_[a-z0-9]{8}$/` and `handle_renamed_at is null`). Choosing the first real handle never starts the
    clock (Q8).

`HandleVerdict` gains `'soon'`. `HANDLE_REASON.soon` and `PROFILE_HANDLE_REASON.soon` are "You can change your handle
once every 30 days." The profile adds "Next change: ‹date›" from `handle_renamed_at + 30 d` (UTC date, `en-US` short).

### 6.2 Deletion

`lib/delete.ts` is unchanged in code: the `user_id` foreign key's `on delete set null` releases the link, and the
current handle is reserved for a year. A hold never blocks deletion (no foreign key restrict). The old handle then
shows the `retired` page, never data. Holds end at their own release date; nothing is retired forever (Q2b).

### 6.3 Display names (`lib/handles.ts:177`)

`NAME_WORDS` becomes boundary-aware: `/(^|[^\p{L}\p{N}])(verified|official|ver+[il1]?f[il1y]+e?d|of+[il1]c+[il1]?a[l1])(?=$|[^\p{L}\p{N}])/u`,
the brand words stay substring rules (v2 E7: "StockSocialFan" refused). It runs over the same forms: skeleton, leet, squash, punctuation-free.
- "Unofficial Notes" is accepted (the letters sit inside a longer word).
- "Un-official", "Official Desk", "v.e.r.i.f.i.e.d" and "Maya Verifled" stay refused.

Handles keep their substring rules (`RESERVED_SUBSTRINGS`): the word-boundary decision is about display names.

### 6.4 One normaliser

`lib/text-safety.ts` (`sanitizeUserText`, `skeleton`, `leet`, `squash`) is the only place that does
`.normalize('NFKC')` or holds a look-alike map. `lib/handles.ts` (`checkDisplayName`, `checkHandle`, `hskel`) is the
one entry for handles and names. The callers that must import it:
- sign-up: `lib/auth/attempts.ts#createUserForAttempt`, `app/actions.ts#login`
- rename: `changeHandle`
- display name: `checkDisplayName`, `recheckDisplayNames`
- reports: `lib/reports.ts` uses `normalizeHandle` + `checkHandle`'s `routeHandle`

There is no user or handle search today. `/t?q=` is a ticker parse (`lib/ticker.ts`), not user text; the test records
that. `lib/claims.ts:72` `normalizeInstitution` (vendor institution names, not user text) is the one allowlisted NFKC
outside text-safety.

## 7. Where the hide reaches (and how it is proved)

| Surface | Mechanism | Proved by |
|---|---|---|
| Feed `/` | `lib/feed.ts` elig + card reads | e2e `f16-hide.spec.ts` (card gone), db test |
| `/t` index | `visibleUserIds` | e2e |
| `/t/<SYM>` (counts, theses, open positions, related) | already on the predicate + `open-positions.ts` | e2e |
| `/t/compare` | `visibleUserIds` | e2e |
| `/t/<SYM>/opengraph-image` | `visibleUser('u')` | e2e: image bytes equal the symbol's no-trades image captured before the fixture's trades were inserted |
| Profile, `/u/<h>/opengraph-image`, `/story` | `handleStatus` + `record-card-data.ts` | e2e: page 404 + notice; images 404 |
| Trade page and image, month page and image | `trade-share-load.ts`, `recap-load.ts` | e2e: 404 |
| Pane JSON, pane-chart JSON | route lookups | e2e: 404 with `cache-control: no-store` |
| Sitemap | `lib/sitemaps.ts` | e2e: a symbol held up by two verified fixture traders drops out when one is hidden |
| Similar, likes, follows, Record tools, display log, view counts | predicate swaps | db tests |
| Rename chain | hide is keyed on the user id: a renamed hidden trader is hidden under the new handle; the old handle is `retired`; a ticker-rename chain is the same `closed_trades` rows by symbol | e2e: rename then hide, both the old and new handle's trade URLs are 404 (Q10 states the interpretation) |

## 8. Tests per acceptance criterion

**F-16**

| # | AC | Test file → what it asserts |
|---|---|---|
| 1 | Read test fails on any `from closed_trades` read without the predicate | `lib/f16-visible-reads.test.ts` (§5.2), plus a self-test: a synthetic source string without the predicate fails the checker function |
| 2 | e2e hide of a demo profile: counted nowhere on the feed, `/t`, `/t/<SYM>`, `/t/compare`, stock og, profile image, sitemap | `e2e/f16-hide.spec.ts`. Fixtures:<br>• demo trader `f16d_<tag>`: `activities` row with `source='demo'`, 5 closes on symbol `ZQ<tag>` with large returns and recent dates (top of the feed);<br>• two verified traders on `ZR<tag>` (3 closes, so the symbol is in the sitemap).<br>Checks each surface before, runs `scripts/hide.ts` via `execFileSync(process.execPath, ['scripts/hide.ts', …])`, checks again, unhides in `finally`. Takes `feedLock('shared')` like the other feed specs. |
| 3 | N distinct reporters, the profile stays public | `lib/f16-reports.db.test.ts`: 3×`REPORT_HOLD_AT` + 1 accounts report one demo profile; `hidden_at` is null, `visibleUser` row present, the feed candidate query still returns it |
| 4 | Signed out can't report; per-reporter limit; no second report | unit: `reportProfile(null, …)` → `signed-out`; `reportProfileAction` without a session → `signedOut` copy.<br>db: second call → `already`; second target within a minute → `rate`; sixth target in a day → `rate` (limiter injected). |
| 5 | Uses F-9's `lib/reports.ts`, no second reports table | `lib/f16-reports.test.ts` parses `db/schema.sql`:<br>• exactly one `create table` whose name matches `/report/`;<br>• `reportProfile` is exported from `lib/reports.ts`;<br>• no other file inserts into a `*report*` table. |
| 6 | Fixed categories incl. "impersonating this trader elsewhere", no platform | `lib/f16-copy.test.ts`: `REPORT_CATEGORIES` is frozen, has 6 entries, includes both labels exactly; no label matches `MARKS` / `MINORS` / `PROMO` (`scripts/compliance.ts`) or /skill\|fake\|edge\|signal/i. The compliance scanner runs over the tree in CI. |
| 7 | Reported person never sees the reporter | db: render-data of the profile (`load`), pane JSON, `exportFor(trader)` serialised contain no reporter id or handle; the source test from §5.5 (where `thesis_reports` may appear) |
| 8 | Hide only a profile or a thesis; single trade refused; no delete on hide or unhide | `lib/f16-hide-script.test.ts`:<br>• `run(['trade', …])` exits 2 with the sentence;<br>• `hideItem('trade')` throws;<br>• source of `lib/trust-hide.ts` and `scripts/hide.ts` has no `/\bdelete\b/i` statement and no `lib/delete.ts` import.<br>`lib/f16-hide.db.test.ts`: row counts of `closed_trades`, `activities`, `kept_theses`, `thesis_reports` and `users` are equal before and after hide plus unhide. |
| 9 | Audit row per hide/unhide, no thesis text; `SCHEMA_MAP` entry | db: each of the 4 operations writes exactly one row with item id, kind, a reason from the list, actor `'owner'` and a time; the `trust_audit` column list has no text column but `reason`/`actor`/`kind`/`sell_id`; a thesis text inserted in the fixture never appears in any audit column; `SCHEMA_MAP.trust_audit` exists (the existing `privacy-retention.test.ts` also fails without it) |
| 10 | Hidden URL: one notice, own title, one h1, noindex, none of "reported", "review", "under review" | `e2e/f16-pages.spec.ts`:<br>• status 404, title "Profile not available · Stock Social", `h1` count 1, robots noindex;<br>• `main` text has no `/report|review/i` and no `%`, Verified or Demo badge.<br>Repeated signed in as the trader (the private line is there, still no forbidden words). |
| 11 | Digest is a script; never reads the dev session | `lib/f16-digest.db.test.ts`: under-18 group first, counts right, links built from `siteUrl`. Source: `lib/trust-digest.ts` and `scripts/trust-digest.ts` import nothing from `lib/session.ts` or `next/headers`; no `app/**/digest*` route exists. |
| 12 | No email; templates carry no handle, name, thesis, symbol or return | `lib/f16-no-email.test.ts`:<br>• no trust file imports `lib/auth/email.ts` or `fetch`;<br>• every `*_MAIL` export in `lib/copy.ts` (today `LOGIN_MAIL`) rendered with sentinel values contains no handle/name/symbol/percent sentinel and no `${`-built record field. |
| 13 | Takedown page: own title, draft, no safe harbor or agent, no personal address, unreachable on real-user deploys until approved | `lib/f16-takedown.test.ts`: the launch-gate matrix for `takedownReachable`: draft×{open, closed} → false; draft×sandbox → true; approved×open without contact → false; approved×open with contact → true.<br>Copy regexes (§5.7); `TAKEDOWN.approved === false` in the repo; P1 scanner over the file.<br>`e2e/f16-pages.spec.ts`: sandbox shows the draft banner and its title. |
| 14 | Anti-impersonation line on profile and pane, on no image route; no platform; F3 disclaimer in view beside it at 360 px | `e2e/f16-pages.spec.ts` at 360×740: scroll the line into view, then both its box and `footer.site`'s disclaimer box are in the viewport; the pane (open a feed card's pane) shows the line and its disclaimer.<br>`lib/f16-images.test.ts`: no `opengraph-image.tsx`, `story/route.tsx`, `home-card`, `record-card-image.tsx`, `lib/record-card.ts` or `lib/month-card.ts` imports `TRUST_LINE`/`TrustFoot`; `recordCard()`, `tradeSharePayload()` and the month model strings don't contain the line.<br>`lib/f16-copy.test.ts`: `MARKS` and `/verif|identity|confirmed|real person/i` not in the text; it contains `PRODUCT_NAME`. |
| 15 | Report form: axe + keyboard e2e; errors and sent announced, take focus | `e2e/f16-report-form.spec.ts`, keyboard only (Tab, Enter, Space, arrows):<br>• menu → report page → submit empty → `role=alert` text, focus on the first radio, `aria-invalid` on all radios;<br>• choose with the arrow keys → submit → `role=status` focused with "Report sent. Thank you.".<br>**Axe substitute (§0.1):** every input has a label (`getByLabel` resolves each of the 6), one h1, legend present, unique ids, every control ≥ 44 px tall, focus ring visible (computed outline ≠ none), no positive tabindex. `ponytail:` axe once the owner authorizes it. |
| 16 | Digest page, if built | N/A (script, Q7). The test in #11 asserts no digest route. |
| 17 | Runbook: no secrets or personal data, no instruction to delete | `lib/f16-runbook.test.ts`:<br>• `scanText` from `scripts/compliance.ts` returns nothing;<br>• no `/delete from\|drop (table\|schema\|database)\|truncate\|rm -rf/i`;<br>• no line pairing `/agent\|claude\|bot/i` with `/delet\|purg\|drop/i`;<br>• the replay section is headed "Owner only". |
| 18 | PR answers COMPLIANCE §1 Q2 and Q4 | PR body `## Compliance` (§10 below) |
| 19 | Limits marked `ponytail:` and listed in the hand-off | §9 list; the reviewer checks |
| 20 | Under-18 report: same form, labelled; hides nothing; digest first | e2e: the "May be under 18" radio is found with `getByLabel`. db: after 1 and after 20 under-18 reports, `hidden_at` is null. Digest test (#11). |
| 21 | Over the per-reporter or per-target limit refused; second open report refused | db: per-target: 10 reporters within an hour, the 11th → `rate`, row count 10; per-reporter as in #4 |
| 22 | Trader's views and account export have no reporter identity | #7 |
| 23 | After a hide: profile image, trade and month images, cached JSON and sitemap 404 or neutral, incl. rename chain | `e2e/f16-hide.spec.ts`: each URL's status 404 (JSON with `no-store`); rename then hide → old- and new-handle trade URLs 404 |
| 24 | Audit row and hide in one transaction | db: `deps.audit` throws → `hidden_at` still null and no audit row (same for thesis) |

**F-17**

| # | AC | Test file → what it asserts |
|---|---|---|
| 1 | Reserved list only generic and own-product words; no third-party or person name | `lib/f17-handles.test.ts`: no entry of `RESERVED`, `RESERVED_SUBSTRINGS`, `STAFF_WORDS` or the fixtures matches `MARKS` or a people list. The vendor word is allowed by the T1 reading (Q1); the test names it as the one integrated-vendor entry. |
| 2 | Sign-up and rename refuse reserved and look-alikes (reserved, demo, connected, F-7) | unit `handleVerdict` per class; db: `createUserForAttempt` and `changeHandle` each refuse `admin`, a demo look-alike, a connected trader's skeleton twin and a `pf_` filer twin |
| 3 | 50 renames in a loop: second within 30 days refused; ≤ 1 hold row | `lib/f17-rename.db.test.ts`: loop 50 `changeHandle` to fresh handles; exactly 1 succeeds after the first counted rename, 49 throw `soon`; `count(*) from handle_reservations where user_id = u and until > now()` ≤ 1 throughout |
| 4 | New rename releases the older hold; rename back works | db with a clock (backdate `handle_renamed_at`): A→B, backdate, B→C (A's hold ended, B held); C→B (rename back) allowed without backdating |
| 5 | Hold row: handle + release date ≤ 1 year; `deleteProfile` leaves no hold linked; never blocks deletion | db: the column set is `{handle, until, user_id}` (Q2); `until ≤ now() + 365 d`; after `deleteProfile`, `user_id` is null on every hold and the deletion succeeded with 1 hold present |
| 6 | Old path: 404, neutral page, own title, no content, no link to new handle | `e2e/f17-handles.spec.ts`: rename, then `goto('/u/<old>')` → 404, title "Handle no longer in use · Stock Social", h1 "This handle is no longer in use", no link whose href contains the new handle, no `%` |
| 7 | Display names: NFKC (matching), direction controls stripped, check and seal glyphs refused, whole "Verified"/"Official" refused, incl. a bidi name | `lib/f17-handles.test.ts`: "Ｖｅｒｉｆｉｅｄ" refused; "Ver‮ified" refused (`verified`); "Ma‮ya" stored as "Maya"; "Sam ✓" and a seal glyph (U+1F5F8/U+2BBD set) refused |
| 8 | "official" inside a longer word accepted | "Unofficial Notes" and "Officialdom Fan" accepted; "Un-official" refused |
| 9 | Display-name check calls F-9's normaliser; a second confusables map fails a test | `lib/f17-normaliser.test.ts`: `lib/handles.ts` imports `skeleton`/`sanitizeUserText` from `lib/text-safety.ts`; no file outside `lib/text-safety.ts` has `normalize('NFKC')` (allowlist: `lib/claims.ts`, vendor names, and `lib/handles.ts:188`'s glyph test) or an object literal with ≥ 3 Cyrillic/Greek keys |
| 10 | Rejection beside the field, `aria-describedby`, `aria-invalid`, announced on submit; e2e one reserved and one bidi on sign-up and on rename | `e2e/f17-handles.spec.ts`:<br>• sign-up: handle `admin` and name "Ver‮ified";<br>• rename: handle `support` and `ad‮min` (pattern attr removed in the test to reach the server).<br>Each: the alert is the field's next sibling, `aria-invalid=true`, `aria-describedby` includes the alert id, focus on the field. |
| 11 | Rejection logs hold no handle attempt tied to a person, no email, no name | `lib/f17-logs.test.ts`: spy `console.*` while running refused `changeHandle`/`createUserForAttempt`/`checkDisplayName`; nothing logged containing the typed handle, name or an `@`; a source scan of the four files finds no `console.` call taking those variables |
| 12 | Gate closed: rename onto a listed handle refused | db: env `LAUNCH_ALLOWLIST=f17_<tag>`, gate closed → `changeHandle` → `reserved` |
| 13 | PR answers COMPLIANCE §1 Q2 | §10 |
| 14 | `ponytail:` limits | §9 |
| 15 | A caller normalising without the one normaliser fails a test | #9 (callers listed in §6.4) |
| 16 | Confusables set (mixed script, zero-width, bidi override, full-width, case fold) | `lib/f17-handles.test.ts` table:<br>• "Vеrified" (Cyrillic е), "Ver​ified", "Ver‮ified", "Ｏｆｆｉｃｉａｌ", "OFFICIAL" → refused;<br>• handles "аdmin" (Cyrillic) → format;<br>• "ADMIN" → `normalizeHandle` folds → reserved. |
| 17 | After rename, old handle's image, card and og:image don't serve content | db: `loadRecordCard(old)`, `loadTradeShare(old, sell)` and the recap loader return null. e2e: `/u/<old>/opengraph-image`, `/story`, `/trade/<sell>/opengraph-image` → 404. |
| 18 | Rejection shows its rule in visible text, `role=alert`, focus, at 360 px | #10 at 360×740, the alert box within the viewport next to the field |

## 9. Limits left (each a `ponytail:` in code, listed in the hand-off)

1. Cached responses: pane JSON (60 s) and images (300 s) can stay in a browser or CDN after a hide or rename. Next
   step: versioned keys with a purge on hide, delete and rename (C3-35's condition), or `no-store` once F-15 shows
   the traffic.
2. No axe scan (§0.1). Next: `@axe-core/playwright` after owner pre-authorization and a `LICENSE_REVIEWED` entry.
3. Reports count from cheap dev-stub accounts. Next: meaningful with real authentication (F-9's existing ponytail).
4. Owner-only CLI for hide, digest and resolve. Next: an admin page once real admin identity exists.
5. Per-target limit refuses honest reports during a flood. Next: accept and count beyond the limit once the digest
   shows floods.
6. The digest lists at most 50 profiles per category. Next: a `from` cursor.

## 10. COMPLIANCE §1 answers (for the PR's `## Compliance`)

1. **Performance:**
   - No new performance surface. A hidden profile shows no figure anywhere.
   - The anti-impersonation line sits with the F3 disclaimer.
   - Categories and reasons never judge skill or a record.
   - A hide is whole-profile or thesis only (TR-1) and owner-run, so it can't select losses.
2. **Personal data (Q2):**
   - `thesis_reports` (+ `target`, `category`, `resolved_at`, `resolution`): reporter and trader ids, category and time.
     Only the owner sees it, through scripts. Never shown to the trader, never exported. Deleted with either account
     (cascade).
   - `trust_audit`: kind, user id, sell id, action, reason code, actor, time; no text. Owner only. Cascade.
   - `users.hidden_at`: not displayed; its effect is the neutral 404.
   - `users.handle_renamed_at`: private, the 30-day rule.
   - `handle_reservations`: handle, release date ≤ 1 year, holding-account id nulled on deletion, at most 1 per account.
   - No logs of any of these. No new cookie, no form field beyond one category radio.
3. **Money:** none.
4. **Email, push, SMS, tracking (Q4):**
   - No message is sent. The digest is terminal output.
   - No sender is configured and no template is added. A test pins that any future template carries no handle, name,
     thesis, symbol or return.
   - The line's claim depends on F3b staying as it is.
   - No tracking.
5. **User text:**
   - No new free text; reports are categories only.
   - Display names get word-boundary rules with one normaliser.
   - Held stays held: a hidden thesis is `held`, never dropped.
6. **Sign-up, age, identity:**
   - Handle and name rules at sign-up and rename; one rename per 30 days.
   - K18: an under-18 report category with no date of birth, ID or estimation and no age-group words. It hides nothing
     by itself; the owner decides.
7. **Vendors and dependencies:** none. axe is an owner request (§0.1).
8. **Accessibility:** §2 and AC-F16-15 / AC-F17-10: labels, `role=alert` with focus, `role=status`, 44 px, keyboard.
9. **Security:**
   - One new server action, signed-in and rate-limited (per reporter and per target).
   - No new public JSON. Hidden and retired routes answer `no-store` 404.
   - Owner rights never come from the dev stub (scripts only).
   - `proxy.ts` overwrites `x-ss-path` on every request, so a client can't set it.
10. **Claims:** the line is literally true and implies no identity check. The takedown page claims no safe harbor,
    no agent and no response time. Both are draft-gated until the owner approves.
11. **Checkout:** none.

## 11. Rollout and coordination

- **Rollout.** Code-gated, not env-gated:
  - The predicate, reports, hide and digest are live on merge. A hide has no effect until the owner runs it.
  - The line and the takedown page render only in the sandbox until the owner flips `TRUST_LINE.approved` /
    `TAKEDOWN.approved` and sets `TAKEDOWN_CONTACT`.
  - The 30-day rule is live on merge. An account that renamed earlier has `handle_renamed_at` null, so its next rename
    is free.
- **Coordination note to append to `docs/features/logs/coordination-2026-11-01.md`:** "F-16/F-17 (branch
  `claude/f16-f17-trust-safety`)
  - `app/pane.tsx`: one additive line `<TrustFoot inPane />` at the end of the pane section. It does not touch F-11's
    status line or F-21's exclusion line; rebase over them, keep it last.
  - `proxy.ts`: one header line.
  - `lib/feed.ts`: predicate only in join and where conditions (F-21/F-23/F-26 keep the columns).
  - `app/u/[handle]/page.tsx`: `load()`, `generateMetadata`, the rename form and one F-16 block at the end of `<main>`
    (F-11, F-22 and F-26 regions untouched).
  - `PENDING_VISIBLE` emptied.
  - `lib/sync*.ts`, `lib/trades.ts` and `lib/options*.ts` untouched (allowlisted in `lib/f16-visible-reads.test.ts`).
    A new read there must be added to the allowlist with a reason."
- **The not-found mechanism must be verified on 16.4.3.** Segment `not-found.tsx` takes no props
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:131-133`), so it reads the
  path from the `x-ss-path` header (`headers()`) and calls `handleStatus`.
  - Title (v2 E1): under `notFound()`, Next 16.4.3 builds metadata from the layouts and the deepest not-found module
    only (`node_modules/next/dist/lib/metadata/resolve-metadata.js:93-120`). The page's `generateMetadata` is ignored.
  - So `app/u/[handle]/not-found.tsx` exports `generateMetadata`, returning the hidden, retired or generic title from
    `handleStatus` (params if passed, else `x-ss-path`).
  - No React `<title>`: it would duplicate. `none` keeps "Page not found · Stock Social".
  - Proved first by the Step 0 spike (§13).
  - The e2e asserts exactly one `<title>` with the right text and status 404 for both kinds, on `/u/<h>`,
    `/u/<h>/trade/<id>` and `/u/<h>/report`.

## 12. Open questions (each with the recommended option)

1. **Vendor name in the reserved list** (§0.2). Options:
   - (a) remove it per the decision's literal wording, changing four assertions;
   - (b) keep it under T1's integrated-vendor exception.

   **Recommend (b):** no existing test is weakened, the protection stays, and F-17's own Out of scope sends named-firm
   impersonation to F-16. The owner confirms the reading.
2. **Hold row columns** (§0.3).
   - **Recommend:** `{handle, until, user_id}`, with the link nulled on deletion; rename-back needs the link.
   - 2b. On deletion, held old handles keep their release date (link nulled) rather than ending at once. **Recommend
     keep:** it stops a stranger taking a just-deleted trader's old handle, and nothing is retired forever.
3. **Look-alike scope** (§0.4). **Recommend:** keep the existing superset (every account), not "only connected". It is
   stricter and no test is weakened.
4. **NFKC in storage vs matching** (§0.5). **Recommend:** matching only (F-9 fix round 5); tests cover full-width.
5. **A database constraint for profile rows** (`(target='profile') = (sell_id='')`). **Recommend:** enforce in code with a
   db test now. Add a guarded `do $$` constraint only if the reviewer wants defence in depth; it needs a pattern the
   schema file doesn't have yet.
6. **One report per reporter and profile: ever, or once per open period?** **Recommend:** ever (the unique row). It
   meets both "report one profile once" (cycle 2) and "one open report" (cycle 3), and stops re-reporting after an
   unfounded resolution.
7. **Digest: script or flag-gated page.** **Recommend:** script (§5.6). There is no session to misuse, nothing to 404,
   and it matches `scripts/review-theses.ts`.
8. **Rename clock exemptions.** **Recommend:**
   - leaving the untouched provisional `trader_…` handle doesn't start the clock;
   - renaming back to one's own held handle is allowed at any time and doesn't reset it.

   Either way at most one hold is ever held, so squatting can't grow.
9. **Tell the hidden trader?** **Recommend:** yes, one private line on their own profile (§2.1) that says "not shown to
   others right now", never "reported" or "review", with a link to settings. Due process without marking them
   publicly.
10. **"Rename-chain path"**. **Recommend reading it as both:**
    - the handle chain: old handles held by a rename and the trader's current handle, keyed on the user id;
    - the ticker-rename chain: the same `closed_trades` rows found by symbol.

    The e2e covers the handle chain; the predicate covers both.
11. **Visible "New handle" label.** It is `sr-only` today. **Recommend:** make it visible: WCAG 3.3.2, and the F-17
    rules need a visible field name to sit beside.
12. **Hidden-profile status.** **Recommend:** 404 (with the neutral notice), not 200. That is the same answer as its
    images and JSON, and Next adds noindex.
13. **Owner-only items** (POLICY H; they wait for the owner, not the committee):
    - approve the line and the takedown wording (flip the two constants);
    - set `TAKEDOWN_CONTACT` to a role mailbox;
    - choose an email sender before the digest is ever emailed;
    - choose the K18 age-assurance method;
    - pre-authorize axe-core (MPL-2.0) or accept the substitute;
    - confirm Q1.

## 13. Build split (v2, engineer's)

- **Step 0 (lead, first):**
  - the schema block (§3);
  - the `lib/visible-users.ts` helpers (`visibleUser`, `visibleUserAsOf`, `visibleUserIds`, `visibleOwner`, `visibleId`,
    `handleStatus`);
  - `HIDDEN_RULE` and the `REPORT_CATEGORIES` codes in `lib/report-copy.ts`;
  - `proxy.ts` `x-ss-path`;
  - the not-found spike: `app/u/[handle]/not-found.tsx` with `generateMetadata`, and one e2e that `/u/h`,
    `/u/h/trade/x` and `/u/h/report` answer 404 with one title and one h1, plus the B4 `no-store` check.
- **A, the predicate sweep:**
  - `lib/feed.ts`, `similar`, `likes` (non-private reads), `follows:18`, `record-tools:206`, `display-log`,
    `discovery/*`, `home-preview`, `recap-load`, `trade-share-load`;
  - `app/u/[handle]` `record-card-data`, `pane/route`, `pane-chart/route`, and the three og images under
    `u/[handle]` (with the E2 header);
  - `app/t/compare`, `[symbol]/opengraph-image`, `open-positions`;
  - tests: `fixes-cycle2-trust.test`, `f16-visible-reads.test`, `f16-visible.db.test`, `e2e/f16-hide.spec`.
- **B, reports, hide and digest:**
  - `lib/reports.ts`, the rest of `report-copy`, `thesis-save`, `thesis-review`, `trust-hide`, `trust-digest`,
    `privacy-retention`;
  - `scripts/hide.ts`, `scripts/trust-digest.ts`, `app/report-actions.ts`, the runbook;
  - tests: `f16-reports*`, `f16-hide*`, `f16-digest`.
  - Seam: `reportProfileAction(prev, formData) → { state, message }`.
- **C, UI:**
  - `app/u/[handle]/not-found.tsx` (from the spike), `report/page.tsx`, `report/report-form.tsx`, `app/trust-foot.tsx`,
    `app/takedown/page.tsx`, `lib/takedown.ts`;
  - the F-16 blocks in `lib/copy.ts` and `globals.css`, `.env.example`;
  - the mounts in `feed-rows.tsx` and `lazy-pane.tsx`;
  - all of `app/u/[handle]/page.tsx`, including the rename form;
  - tests: `f16-static`, `e2e/f16-pages`, `e2e/f16-report-form`.
- **D, F-17:**
  - `lib/auth/attempts.ts`, `app/auth/actions.ts`, `lib/handles.ts`, `app/login/dev/page.tsx`;
  - tests: `handles.db.test`, `attempts.test`, `f17-*`, `e2e/f17-handles.spec`.
  - D exports `HANDLE_REASON.soon`, `RENAME_RULE` and `nextRenameAt` from `lib/handles.ts` for C.

## R3. Round 3 changes (v3, signed)

- **Engineer (round 2, blocking): B3's `until = now()` changes two existing assertions.** `lib/auth/attempts.test.ts:158`
  and `:162` assert no `handle_reservations` row for a taken-back handle. Under B3 the row stays with its hold ended.
  Both are rewritten to the same strength: no active hold on the handle (`until > now()` returns 0 rows) and the row's
  `user_id` is still this account. They join §0.7's decision-mapped changes. `lib/f17-rename.db.test.ts` adds a step:
  rename back, then rename away again; the ended row is re-held through the existing `on conflict (handle) do update`
  (`lib/auth/attempts.ts:177-178`).
- **Business lead (round 2, conditions on B4):** the `no-store` assertions run on the production build
  (`npm run start`, as `npm run test:e2e` does), never under `next dev`. If the `proxy.ts` fallback is needed it sets
  `private, no-store` on `/u/*` page responses only (dynamic pages; never on the image routes), and an e2e pins that a
  visible profile's og image keeps `public, max-age=300`.
- **Owner list (Q13) adds:** cached share images and JSON may outlive a hide or a rename by at most 300 s and 60 s.

Signed: business lead (round 2), engineer (round 2, with the item above, which is the engineer's own fix verbatim).
