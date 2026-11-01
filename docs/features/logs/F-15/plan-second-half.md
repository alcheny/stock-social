# F-15 second half: plan (UX lead draft, 2026-11-01)

Reads with `docs/features/F-15-measurement-foundation.md` (the WHAT), `facts-second-half.md` and the first-half
`plan.md` / `committee-2026-11-01.md` (every first-half decision stands). One PR from `claude/f15-second-half`:
(1) `share_action` rows (E5, G2), (2) beacon into `app/layout.tsx`, `app/template.tsx` deleted, (3) canonical links.

## 1. Screens and states
Nothing a person sees changes. Share stays one tap; "Link copied" stays in the polite live region; no count is ever
shown to a trader. States: signed out, viewer, owner, demo, new trader (0 trades), all losses, importing, failed copy
(fallback field), sheet cancelled. Only an owner's completed share writes a row; a cancelled sheet, a failed copy and
"Not now" write nothing new (the prompt's `dismissed` keeps going to the old column only).

## 2. Part 1: `share_action` rows
**Q1 Row shape.** (a) **One row per completed share action, day only (UTC date, no time of day), closed-set fields only,
no id column, capped at 20 rows per trader per UTC day.** Matches the AC's wording and E5; with day-only rows it holds
exactly what a daily aggregate with `n` holds (the orchestrator's privacy bar), and no serial id leaks the order of
shares across traders. (b) Daily aggregate per trader (`day, user_id, surface, outcome, format, sign, n`, upsert): same
information, but fails the AC's "one row per share action" literally. (c) One row with timestamp: time of day is more
than G2 needs (P3). The cap bounds a scripted loop; G2 needs only "≥ 1", so it never changes a gate figure.
**Schema (additive, block `-- F-15 second half` in `db/schema.sql`):**
`share_action (user_id int not null references users on delete cascade, day date not null default current_date,
surface text not null, outcome text not null, format text not null, record_sign text not null)` + index on
`(user_id, day)`. No CHECKs (first-half decision 7: closed lists in code, db test on stored values).

**Q2 Fields (closed lists in `lib/share-actions.ts`).**
- `surface`: the share class from the registry, `card | story | trade | month` (`lib/referral.ts#SHARE_VIAS`), so a
  share and the view it brings use the same code. `story` ⇔ profile + picture.
- `outcome`: `sheet` (the share sheet resolved) or `copy` (link copied, including a sheet that failed and fell back).
- `format`: `picture` (sheet took the image, mode `files`) or `link`. Kept although `story` implies it: E5 lists it,
  and a db test asserts `story ⇔ picture`.
- `record_sign`: computed on the server at write time, never sent by the client: `up | down | flat | none` =
  `lib/format.ts#tone` of the headline average return per trade (`stats(closes).avgReturn`, the profile's own
  function); `none` when there is no closed trade or the record shows no stats (import running). Recommended over a
  per-trade sign: E5 says "record sign", and the trade's own sign would tie the row to one trade.
- Never stored: destination, recipients, thesis, account id, sell id, month, path, handle, via of the landing link,
  which button (prompt or card), time of day, IP, agent, session, cookie.

**Q3 Who.** (a) **Only the record's owner sharing their own record**: the server action receives the shared path, takes
the handle from it, and writes a row only when it equals the signed-in, non-deleted session user's handle; the path is
then dropped. `isOwner` on the client becomes advisory. (b) Trust the client's `isOwner`: a bug or a forged call would
mis-attribute a viewer's share. A viewer's share of someone else's record is never stored: it would be a per-viewer
event (F-2's opt-in activity log, off by default, decision 2), it ties a viewer id to a target trader (who shares whom,
P3), and G2 is a supply gate that counts only traders. Fix on the way: the month page passes `isOwner={false}` always, so
owner month shares are lost today; it passes `me?.handle === handle` like the trade page.

**Q4 Where recorded.** (a) **One new server action `recordShareAction(path, how, format)` in `app/actions.ts`, a thin
shell over `lib/share-actions.ts#shareActionRow` (pure: inputs → row or null) and `#writeShareAction` (cap + insert),
called from `onShared` in all four callers** (profile card, prompt, card's month recap — which records nothing today —,
and `TradeShare` for trade and month). `ShareButton.onShared` gains a second argument `format: 'picture' | 'link'`
(`mode === 'files'`); existing callers ignore it. The old writes (`markShareImageSaved`, `recordSharePromptAction`,
`recordTradeShared`) stay byte-for-byte; reads move (the readout is the only reader). (b) `ShareButton` calls the action
itself: hides the owner check inside a shared control used by viewers too. Cap: `insert ... select ... where (select
count(*) from share_action where user_id = $1 and day = current_date) < 20`; errors go to `logSafe`, never to the page.

**Q5 Retention.** (a) Account lifetime: "ever" literal, but holds share history with no gate need. (b) **120 days, a new
`shares` step in the existing privacy purge on the sync tick** (`PurgeStep` + report key), the same number as the
rollup so the Privacy Policy states one; covers week 8 (56 days) plus re-reads; owner may change it. (c) 400 days.
Deletion: an explicit `delete from share_action where user_id = …` in `lib/delete.ts` beside `view_rollup` (profile
delete is a soft delete, so the cascade alone doesn't fire), plus the cascade. `SCHEMA_MAP`: `personal: true,
retention: 'short'`, holds text naming every column.

**Q6 Readout G2 (`scripts/f15-readout.ts`).**
- Strict row, first: "Of those, share their card at least once", "≥ 60%" verbatim, value = strict-G1 traders with ≥ 1
  `card` or `story` row on or before the window's last day, as `x of G1 (p%)`. "Ever" = since the slice and within
  retention; the readout prints the slice's first row day and "within 120 days". `G2_TEXT` is retired.
- Partial rows (labelled partial, overlapping, not a split): any surface; trade or month only; sheet; copy; picture;
  record down at the share. Traders, not actions, on every row.
- Suppression: each row is the pair (sharers, G1 − sharers) through `suppress()`, so a count of 1-4 on either side
  prints "<5" and the percent "(s)": a near-total share can't reveal the few non-sharers by subtraction. Demo and
  deleted users excluded by the G1 join; no handle, id or return selected.
- 14-day rate per weekly cohort: (a) **not printed; one fixed line "14-day share rate per weekly cohort: not printed
  (gate definition, MRC2-3, owner)"**. It is a definition beyond strict, and weekly cohorts stay under 5 for weeks.
  (b) Printed as partial with suppression: invites reading it as G2. (c) Compute but hide: dead code.
- Shares before the slice (old columns): (a) **not read; one line "Shares before <first row day> are not counted"**. The
  slice lands before week 1 and real users wait for the Privacy Policy, so old-column shares are demo/test only, and
  `trade_shared_at` (overwritten) can't say "at least once" reliably. (b) A partial line from the union: two sources,
  double-count risk, no real user to measure.

**Q7 `lib/display-log.ts`.** (a) **No change.** The approval record (K3, chair's reshape; members EN/RE/TS) names it
only as a file the share half would collide with while F-4/F-13 were open, so "edits display-log.ts" was a sequencing
reason, not a requirement. Nothing in E5 needs it: the sign is computed live from `closed_trades` with the same
`stats()`/`tone()`, and reading a daily snapshot would be "as of the tick", not "at that moment". The display log is
append-only (D14) and public-record evidence; mixing share data into it would widen what it holds. (b) Read the sign
from today's `display_log` row: parses display text, may be a day old. The plan says this to the owner (item 4).

## 3. Part 2: beacon into the layout
**Q8 Mount.** (a) **`<ViewBeacon />` as the last child of `<body>`, after `</footer>`**: renders `null`, so no node,
never between the skip link and content, never in tab order. (b) First child of `<body>`: harmless but sits before
the pre-paint script in the source. Delete `app/template.tsx`. The beacon's effect is keyed on `usePathname()`, so a
persistent layout keeps one-beacon-per-pathname; the module-level landing state is unchanged.
CSP/nonce: none needed. The beacon is a client component with no inline script; its POST is same-origin
(`connect-src 'self'`); the nonce stays only on the pre-paint script. The layout is already dynamic (`headers()`).
**Tests.** `lib/f15-isolation.test.ts`: the template test is replaced in place (count unchanged, not weakened):
"`app/layout.tsx` mounts `<ViewBeacon />` once, after the footer, and `app/template.tsx` does not exist".
`e2e/f15-beacon.spec.ts` (runs the existing focus/DOM/CLS/pane tests against the layout mount) adds: (1) first Tab
lands on the skip link and the focus order of the page equals a stored list from main; (2) feed scrolled, pane opened
and closed, back from a profile: scroll offset restored within 1 px; (3) soft nav `/u/a` → `/t` → `/u/b` (crosses the
first segment the template used to remount on) sends exactly one beacon per counted pathname, none for `/t` re-renders.

## 4. Part 3: canonical links
**Q9 How.** (a) Absolute from `siteOrigin()` in each page: three call sites, `lib/billing.ts` (sql, checkout) imported
into pages. (b) **`metadataBase: new URL(siteOrigin())` in the layout's metadata, relative `alternates.canonical` per
page**; `siteOrigin` moves to a tiny `lib/site.ts` that `lib/billing.ts` re-exports (the layout must not import the
billing module). (c) Relative with no `metadataBase`: the docs make that a build error or a guessed host.
Side effect of (b), stated in the PR: the existing relative `og:image` URLs resolve against the configured origin
instead of the framework's fallback. Dev/e2e: no `NEXT_PUBLIC_SITE_URL` → `http://localhost:3000`, the e2e base URL,
so `og:image` fetches in `e2e/app.spec.ts` and `e2e/fixes-cycle2-trust.spec.ts` keep working unchanged.
**Paths.** Profile `/u/${user.handle}` (the stored handle, so any accepted spelling of the URL yields one canonical);
trade `/u/${t.handle}/trade/${encodeURIComponent(decodeSellId(raw))}`: decode then re-encode, one spelling however the
request encoded it; month `/u/${r.handle}/month/${r.recap.ym}`. Never a query (`?via=` and paging dropped). Missing
pages set none. Filer (noindex) pages keep noindex and get the canonical too (harmless, one rule).
**Q10 og:url.** (a) **Not set.** Some unfurlers use `og:url` as the click target, which would drop `?via=` and
undercount the tagged G3 rows. (b) Set to the canonical: cleaner previews, loses via. (c) Set to the tagged request URL:
per-variant, needs the request. Ponytail removed from `app/share-button.tsx`.

## 5. Test plan (new or remaining criteria)
| # | Criterion | Test |
|---|---|---|
| S1 | One row per share action | db `lib/f15-share-action.db.test.ts`: 3 owner actions → 3 rows; fields match; day = UTC date, no time column |
| S2 | Deleted with the profile | same file: rows for A, `deleteProfile` → 0 rows for A's id; B's rows untouched |
| S3 | No thesis text or account id (or IP, agent, viewer, session, cookie, fingerprint) | same file: `share_action` columns equal an exact allow-list; added to the existing A2 test's table list in `lib/f15-views.db.test.ts` |
| S4 | Closed values; story ⇔ picture | unit `lib/f15-share-action.test.ts` (`shareActionRow`: unknown how/format/path → null; picture off-profile → null); db: stored values ⊂ lists |
| S5 | Owner only | unit: path handle ≠ session handle → null; e2e `e2e/f15-share.spec.ts`: a viewer's trade share and a signed-out copy write no row; owner card copy, prompt, month recap, trade page, month page each write one with the right surface |
| S6 | Server-side sign | unit: up/down/flat/none incl. 0 trades, all losses, flat after rounding; a client-sent sign is ignored (no parameter) |
| S7 | Cap | db: 25 actions in a day → 20 rows; next UTC day writes again |
| S8 | Old columns unchanged | existing `e2e/app.spec.ts` share-column tests pass unchanged; db test: the four columns exist |
| S9 | Purge after 120 days | db `lib/f15-purge.db.test.ts`: `only: ['shares']` removes day < bound, keeps day = bound |
| S10 | No page or ordering reads it; never shown | `lib/f15-isolation.test.ts`: only `lib/share-actions.ts`, purge, delete and the readout name the table |
| S11 | SCHEMA_MAP, cookie test, log scanner | existing `lib/privacy-retention.test.ts`, cookie test, log scanner, no new exception |
| S12 | G2 readout | `scripts/f15-readout.test.ts`: strict row + threshold verbatim; partial labels; sharers 3 → "<5"/"(s)"; G1 − sharers 2 → both hidden; cohort and pre-slice lines; no handle or return; old `G2_TEXT` assertion replaced in place |
| B1 | Beacon in layout, template gone | isolation test (above) + `e2e/f15-beacon.spec.ts` (3 new cases) |
| C1 | Canonical | unit `lib/f15-canonical.test.ts` (path helpers, encoded id round-trip); e2e `e2e/f15-canonical.spec.ts`: absolute untagged canonical on the 3 pages visited with `?via=card`, an id needing encoding gives one spelling, no `og:url`, 404 has none |

## 6. COMPLIANCE §1
1. Performance: no new display; the sign is stored, never shown, never ranks (S10).
2. Personal data: yes. Fields: trader id, day, surface, outcome, format, record sign. Postgres `share_action`. Owner
   only, through the readout (suppressed, no handle). Deleted with the profile and after 120 days. Privacy Policy text.
3. Money: no. 4. Tracking: first-party only, no third party, cookie or device storage; no email or push.
5. User text: no (thesis never stored). 6. Accounts: no. 7. Vendor/dependency: none.
8. Accessibility: no new UI; live region and focus order tested (A16, B1). 9. Security: one server action, session
   user only, closed inputs, capped; no new endpoint. 10. Claims: none.

## 7. Owner items
1. Privacy Policy text naming `share_action` (P6, H) before any real user. 2. Confirm 120 days for shares.
3. MRC2-3: the 14-day cohort rate and any non-strict G2. 4. Confirm the reading that `lib/display-log.ts` needs no edit.
5. Confirm the cap of 20 a day.

## 8. Pre-authorization
None: no dependency, vendor, font, secret, protected path or counsel item beyond the Privacy Policy text.

## 9. Known limits (`ponytail:` in code)
- The cap check races: concurrent shares can pass 20 by a few; next step: a per-user advisory lock if it matters.
- `sheet` means the sheet resolved, not that anything was posted; `copy` means copied, not pasted (stated in the readout).
- Viewers' shares are not measured (by design); next step: only with F-2's opt-in log.
- Canonical uses the configured origin; a preview deploy without `NEXT_PUBLIC_SITE_URL` points at production.

## Round 2 revisions (orchestrator, after business lead BL1-BL7 and engineer EN1-EN12)
Every demand is accepted; where the two differ, the choice is stated.
1. **UTC day (BL1, EN2).** `day` is written explicitly as `(now() at time zone 'utc')::date` in the insert and in the
   cap's count; no column default is relied on; the purge bound uses `(${now} at time zone 'utc')::date`. S1/S7 run with
   the session at a non-UTC time zone.
2. **No `format` column (BL2).** It is a function of the surface (story = profile picture; card = profile link;
   trade/month = link). Columns: `user_id, day, surface, outcome, record_sign`. `onShared` gains the picture flag only
   to choose `story` vs `card`; the server derives the surface from the path shape and the flag; a picture flag off the
   profile writes nothing. The readout's "picture" row reads `surface = 'story'`.
3. **Disjoint G2 cells (BL3, EN7).** G2 is built from disjoint per-trader base cells on the strict-G1 denominator:
   (profile-surface sharer, other-surface-only sharer, non-sharer) and (sheet only, copy only, both, none) and (shared
   with the record down, not), run through the readout's existing suppression; a printed row is a sum of visible cells
   or "≥ n"/"(s)"; when G1 prints "<5" every G2 cell is "(s)". The "trade or month only" row is dropped. S12 adds the
   12/10/12, 12/9/8 and 12/9/11 cases: no cell under 5 is derivable.
4. **Sign = what the profile shows (BL4, EN5).** One helper `recordSign(userId)` in `lib/share-actions.ts`:
   `select avg(return_pct), count(*) from closed_trades where user_id = $1` (the same rows the profile's `stats()`
   reads) and `publicRecordDetail(userId).public.state`; `none` for 0 trades, `importing` or `failed`; else
   `tone(avg)` (digits 1, as the headline). Chosen over editing the profile render (EN5: no change to a file other builds
   edit). S6 db: equals `tone(stats(rows).avgReturn)` on the three demo profiles, an all-loss and a flat-after-rounding
   fixture, and `none` in the importing/failed/no-trade states.
5. **Fire and forget (BL5).** `onShared` calls the action with `void ….catch(() => {})`, never awaited before "Link
   copied" or the sheet closing. e2e: with the action failing (DB write refused), the live region still says "Link
   copied", no error UI, page usable.
6. **Owner match and path (BL6, EN4, EN1).** One anchored regex after stripping `?…`/`#…`:
   `^/u/([a-z0-9_]{3,20})(?:/trade/[^/]+|/month/\d{4}-(0[1-9]|1[0-2]))?$`, no trailing slash, no `..`; the handle must
   equal the session user's stored handle exactly (the profile route matches exactly: a case variant is a 404, first-half
   QA fix); the session user must be non-deleted (joined in the insert: `and u.deleted_at is null`) and not a demo user
   (no demo row is ever written). The client gate stays (`isOwner` decides whether to call). S5 unit cases: uppercase,
   percent-encoded, trailing slash, `/u/a/../b`, another trader's handle, `?via=` suffix, demo session, marked user.
7. **Cap without a race (EN3).** The insert runs in `sql.begin` behind `pg_advisory_xact_lock(15, userId)` (namespace 15,
   unused: USER_LOCK 1, ATTEMPT_LOCK 2, PURGE_LOCK 3, PRIVACY 41), count then insert. S7: 25 concurrent actions → 20 rows.
   The race ponytail is removed.
8. **Old columns (EN6).** Byte-for-byte: the month page now passes the real `isOwner` for the new row, and `TradeShare`
   calls `recordTradeShared` only on a trade page (a `kind` prop), so `trade_shared_at` keeps meaning a trade share.
9. **Deletion wording (EN1).** `deleteProfile` hard-deletes the users row, so the cascade fires; the explicit delete in
   the mark transaction covers the window between the mark and the users row going (vendor retry).
10. **Canonical (EN8, EN9, BL7).** `siteOrigin` moves to `lib/site.ts` (billing re-exports it, unit test: identical
    outputs); the layout imports only `lib/site.ts` (isolation test: no billing import). Preview deploys: og/twitter
    image URLs resolve to the production origin — stated as a known limit (billing's return URLs unchanged). The trade
    canonical uses the stored sell id from the loaded row through the same helper that builds the trade share link
    (`tradePath(handle, sellId)` in `lib/share.ts`, used by both); C1: canonical = shared link minus `?via=`, and an
    over-encoded request gives the same canonical.
11. **Isolation allow-list (EN10).** Names `share_action` only in: `lib/share-actions.ts`, `lib/privacy-purge.ts`,
    `lib/delete.ts`, `lib/privacy-retention.ts`, `scripts/f15-readout.ts`, `db/schema.sql`, tests; any `app/**` file
    naming it fails (the action calls the lib, it never names the table).
12. **CI (EN11).** Schema block uses `create table if not exists` + `schema_add_index`; no drop/truncate/delete. The
    template and `G2_TEXT` assertions are replaced in place. None of the touched files is in `.github/CODEOWNERS`
    (checked: layout, purge, delete, schema, actions, pages). No dependency.
13. **B1 case 3 (EN12).** Counted with a request counter, not timing.

## Sign-off (round 2)
- Business lead: SIGN (note taken: the path regex comments point at the handle rule in `lib/follows.ts`).
- Engineer: SIGN (nits taken: `SHARE_ACTION_LOCK = 15` with all six namespaces listed; `TradeShare` `kind` is a closed
  union with no default).
- UX lead: plan author; no screen change.

## Independent review (2026-11-01) and fixes
- Blocking 1: Round 2 item 4's premise was wrong: a failed import still shows the headline (with the incomplete line),
  so the sign is kept for it; `none` only with no close or an import running. Fixed in `lib/share-actions.ts`, its db
  test and the decision text.
- Nits fixed: the G2 retention floor is anchored to the window's end (a printed week is stable across runs); the unused
  first-share query is gone; a scheme-less `NEXT_PUBLIC_SITE_URL` gets `https://` and the layout's `metadataBase` can't
  throw; a cheap capped count runs first; the readout and a `ponytail:` say completion is the trader's own browser's
  report. Kept: the trade page re-decodes the matched param (it equals the stored sell id the row matched on).
