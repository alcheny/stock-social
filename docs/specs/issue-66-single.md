# Spec: Referral by surface: month and badge attribution

Variant: **single** · Spec agreed by designer and business analyst

## Agreed spec

# Spec: Referral by surface (issue #66, line A, single variant)

## Goal
Know which share surface (profile link, trade permalink, monthly recap, badge embed) brings a new connected trader, and show the owner a plain-text breakdown. The story image is out of scope: it is a picture with no link, so it can't carry attribution.

## Code facts (verified)
- `lib/referral.ts`: `REFERRED_VIA=['profile','trade']`, `normalizeVia`, `referralSummary` returns `{connected, handles}`, `ReferredRow={id,handle,isDemo,hasSnaptradeActivity}`.
- `db/schema.sql:31`: `referred_via` has an inline CHECK on ('profile','trade'). Don't touch it. CI forbids drop.
- `app/actions.ts login()` inserts `referred_via` from `normalizeVia(form.get('via'))` when a referrer resolves.
- `app/login/page.tsx` already forwards `via` through `normalizeVia`, so it needs no change.
- `app/u/[handle]/join-cta.tsx`: `joinHref(handle, via: ReferredVia)` and `JoinCta`.
- `month/[ym]/page.tsx:98` passes `via="trade"` (bug). `app/u/[handle]/page.tsx:150` hardcodes `via="profile"`.
- `badge-embed.tsx` `snippet()` links to the bare profile URL.
- The owner query is in `app/u/[handle]/page.tsx:54-70`. `ReferralFeedback` is in `referral-feedback.tsx`.

## Changes

### 1. Schema (`db/schema.sql`, after line 31)
```sql
-- Which surface's CTA brought the signup: profile|trade|month|badge. Insert-only. No CHECK on purpose: widening the
-- referred_via CHECK needs drop+re-add, which CI forbids; the allow-list lives in normalizeVia.
-- Measure: among referred users with a snaptrade activity, count(*) by coalesce(referred_surface, referred_via); nulls reported separately.
alter table users add column if not exists referred_surface text;
```
Add nothing else. No drop, truncate or delete.

### 2. `lib/referral.ts`
- `export const REFERRED_SURFACES = ['profile','trade','month','badge'] as const; export type ReferredSurface`.
- `normalizeVia(v): ReferredSurface | null` uses that allow-list. Trim and lowercase as today. It rejects junk and non-strings.
- Keep `REFERRED_VIA` and `ReferredVia` (profile/trade) for the legacy column. Add `legacyVia(s: ReferredSurface | null): ReferredVia | null`, which returns `s` only if it is profile or trade, else null.
- `ReferredRow` gains `referredSurface: string | null`. The caller passes `coalesce(referred_surface, referred_via)`.
- `referralSummary` returns `{connected, handles, byVia: Record<string, number>}`. The filters are unchanged: demo owner, demo user, no SnapTrade activity, self and duplicate rows are excluded. A row with a null surface counts in `connected` and `handles` but is omitted from `byVia`. Never guess.
- A demo owner returns `byVia: {}`.

### 3. Signup (`app/actions.ts`)
```
const surface = referredBy ? normalizeVia(form.get('via')) : null;
const via = legacyVia(surface);
insert into users (..., referred_by_user_id, referred_via, referred_surface) values (..., ${referredBy}, ${via}, ${surface})
```
- The update clause is unchanged, so the columns are insert-only.
- `via=month` stores `referred_surface='month'` and `referred_via` null, so the old CHECK never rejects an insert.
- `via=profile` or `via=trade` writes both columns. This keeps legacy readers working.
- Explain the CHECK workaround in the PR body.

### 4. `JoinCta`
- Widen the `via` type to `ReferredSurface`. `joinHref(handle,'month')` returns `/login?ref=<handle>&via=month`.

### 5. Month page
- `month/[ym]/page.tsx:98`: `via="month"`.

### 6. Badge
- `badge-embed.tsx` `snippet()`: define `const link = \`${profile}?ref=${handle}&via=badge\``. Use `link` for the href in both the markdown and HTML formats. The image URL stays `${profile}/badge.svg`.
- `app/u/[handle]/page.tsx`: extend `searchParams` with `via?: string`. Compute `const via = normalizeVia(sp?.via) ?? 'profile'` and pass it to the signed-out `<JoinCta via={via}/>`.
- Extract a tiny pure helper `ctaVia(raw: unknown): ReferredSurface` in `lib/referral.ts` (`normalizeVia(raw) ?? 'profile'`) so it is unit-testable. The page uses it.
- Do not add `ref` handling beyond this. `JoinCta` already uses the profile's own handle, which equals the badge's `ref`.
- If the badge change grows beyond about 30 lines, drop it and say so in the PR.

### 7. Owner query and `ReferralFeedback`
- Add `coalesce(u.referred_surface, u.referred_via) as surface` to the select, map it to `referredSurface`, and pass `byVia` to `<ReferralFeedback handles byVia />`. The fallback object gains `byVia: {}`.
- Labels: profile = "your profile link", trade = "a trade link", month = "your monthly recap", badge = "your badge".
- Counts are sorted by count descending, then label (ordering only, with no ranking UI). Render one extra `<p className="muted small">` line, for example: "2 from your monthly recap, 1 from your profile link."
- Singular and plural are not needed, because the line is "N from X".
- Skip surfaces with 0 and skip unknown keys. Render no line if `byVia` is empty, and keep the existing "N traders connected" line.
- Plain text only. No icons, no celebration, no ranking and no visitor counts. It is owner-only (`isMe`), so signed-out visitors never see it.

## States
- 0 referrals: nothing is shown (unchanged).
- Referrals with only legacy null rows: the connected line shows and the breakdown line is omitted.
- Signed-out, bad `via`, or `via` junk: the CTA falls back to profile.

## Accessibility
- The breakdown is a plain paragraph with the same muted class as the existing line. No new interaction is added.

## Acceptance → tests
1. `lib/referral.test.ts`:
   - `normalizeVia('month')` and `normalizeVia('badge')` are accepted, case-insensitively.
   - `normalizeVia('bogus')`, `normalizeVia('')`, `normalizeVia(5)` and `normalizeVia(null)` return null.
   - `legacyVia` maps month and badge to null, and profile and trade to themselves.
   - `ctaVia('badge')` returns 'badge'. `ctaVia('x')` and `ctaVia(undefined)` return 'profile'.
   - `referralSummary` `byVia` is correct for a mix of surfaces. Demo users, self-referrals, bare signups (no SnapTrade activity) and duplicate rows are excluded. A legacy row (`referredSurface:'trade'` from the coalesce) counts as trade. A row with `referredSurface:null` is in `connected` but not in `byVia`. A demo owner returns an empty `byVia`.
2. `joinHref('amy','month') === '/login?ref=amy&via=month'`. Add a test that reads `month/[ym]/page.tsx` source and asserts it has `via="month"` and not `via="trade"`. Follow the repo's existing source-grep style if there is one. Otherwise keep the `joinHref` test only.
3. A badge `snippet()` test: markdown and html both contain `ref=<handle>` and `via=badge`. The image URL remains `/badge.svg`. Update the existing snippet tests if they assert the old bare href. Do not weaken them: change only the expected href.
4. Signup: via=month stores `referred_surface='month'` and null `referred_via`. Test through the same route existing signup tests use (e2e or a DB test). If none exists, unit-test the derivation `(surface, legacyVia(surface))` and note that in the QA log.
5. `db/schema.sql` has no `drop`, `truncate` or `delete from`. Existing tests pass, `npx tsc --noEmit` is clean, and the diff is about 400 lines or fewer.

## Non-goals
Story image attribution, visitor counts, ranking, rewards, and any change to the old CHECK.

## Designer ⇄ business discussion

### Round 1

**Designer:** Add a `referred_surface` column (no CHECK) and widen the allow-list to profile/trade/month/badge. Write both columns at signup. Fix the month CTA to `via="month"`. Add `ref` and `via=badge` to the badge snippet. Make the profile page read `via` from searchParams. Add `byVia` to `referralSummary` and one owner-only text line in `ReferralFeedback`.

**Business analyst (approved):**
- Ease of use: Good. The owner sees one plain-text line, such as "2 from your monthly recap, 1 from your profile link". Nothing is shown at 0, there is no new interaction, and signed-out visitors never see it. Badge and recap links fall back to the profile CTA when `via` is junk, so no visitor hits a broken path.
- Retention: Moderate, and appropriate for a measurement step. The owner learns which share worked, which gives a reason to share again on the surface that worked. It adds no streaks, points or rewards, so trust rules hold. Showing only connected referrals keeps the number honest.
- Virality: Positive. The spec fixes the recap misattribution (it passed `via="trade"`) and adds badge attribution, so the next investment can be chosen from real data. Leaving the story image out is correct, since it carries no link.
- Feedback: Approved. Three notes for the build:
1. In the PR body, state that `referred_surface` has no CHECK because widening the old CHECK needs a drop, which CI forbids. Also state that rows with both columns null are counted in `connected` but never guessed into `byVia`.
2. Keep the breakdown ordering as ordering only. Do not turn it into a ranked list or a leaderboard.
3. For the signup derivation test, if there is no DB or e2e signup test, a pure unit test of `(surface, legacyVia(surface))` is acceptable, but record that in the QA log.
Also keep the badge change under about 30 lines, or drop it and say so.

## QA log

| Round | By | Result | Findings |
|---|---|---|---|
| 1 | tester | ✅ pass | [note] app/u/[handle]/referral-feedback.tsx: The breakdown line is a second <p> with the same muted small class, so it adds no new tap targets and wraps as plain text at 360px. I reviewed the code only. I did not run Playwright or the app, so there is no visual check at 360px. · [note] lib/referral.test.ts: Signup is only covered by a unit test of the derivation (normalizeVia then legacyVia). No DB or e2e test checks that the insert stores referred_surface='month' with a null referred_via. The spec allows this, but the QA log should record it. · [note] app/u/[handle]/badge-embed.tsx: snippet() |

## Cost

4 role calls, $0.72 total: designer#1 $0.13, business#1 $0.08, engineer#1 $0.40, tester#1 $0.11
