# F-15 plan: measurement foundation, first slice (UX lead draft, 2026-11-01)

Reads with `docs/features/F-15-measurement-foundation.md` (the WHAT; this plan only decides HOW) and `facts.md` (the
engineer's sketch, accepted with the changes marked **Change**). Status of the feature: `blocked` until fix #28 merges.

## 1. Scope
**In (this build):** E1 view rollup fed by a first-party beacon (2 s visible, bot filter); E2 drop rollup; one closed
`via` registry in `lib/referral.ts`; `?via=` on Share and copy-link; a `views` step in the existing privacy purge;
owner-only weekly readout script; bot-filter validation script and its run recorded in the PR.
**Out (start condition):** `share_action` rows (E5) and every edit to `app/u/[handle]/share-prompt.tsx` and
`lib/display-log.ts` wait for F-13 (#55). No edit to `app/layout.tsx` until F-13 merges.
**Out (feature file):** E4 device-storage date and any signed-out D7 measure, E8 painted door, test-and-roll, gate
redefinitions (MRC2-3), any count shown to traders or used in ordering, the Privacy Policy text.

## 2. Screen and flow
The beacon has **no visible UI** in any state. Nothing on any screen changes except the shared link text.
- **Viewer (signed out or in, any page, demo or real profile, empty feed, all-loss record, new trader):** the page
  renders exactly as today. After the page has been visible for 2 s in total (time hidden in a background tab does not
  count), one request leaves in the background. If it fails, is slow or the route returns 500, the viewer sees nothing.
  No cookie, no device storage, no focusable element, no node in the layout flow, no change to first paint.
- **Soft navigation:** each new pathname starts a fresh 2 s timer; the class is `internal`. Search-param-only changes
  do not count as a new view.
- **Trader sharing:** Share stays one tap. The sheet (or clipboard) receives the link with `?via=<class>` appended;
  the button label reads "Link copied" for 2 s and the existing `aria-live="polite"` span announces "Link copied". The
  failed-copy fallback field shows the same tagged link. `og:url` and canonical stay untagged.
- **Trader never sees a count.** No profile, settings or feedback screen reads the rollup.
- **Owner:** runs the readout locally once a week; output lands outside the repo (section 5, Q7).

## 3. Data model (additive block `-- F-15` in `db/schema.sql`)
```
view_rollup (day date not null, surface text not null, user_id int null references users on delete cascade,
             ref_class text not null check (ref_class in ('internal','external','none')),
             via text not null default 'none', signed_in bool not null, self_view bool not null,
             n int not null default 0,
             unique nulls not distinct (day, surface, user_id, ref_class, via, signed_in, self_view))
view_drops  (day date not null, surface text not null,
             reason text not null check (reason in ('declared_bot','no_fetch_metadata','automation','rate','bad_body')),
             n int not null default 0, unique (day, surface, reason))
```
- Write: one `insert ... on conflict (...) do update set n = view_rollup.n + 1` per beacon. Same for drops.
- `user_id` only for profile, trade and month surfaces, resolved through `lib/visible-users.ts#visibleUser`; null for
  feed, ticker, compare, login, how. No symbol, sell id, month, handle, path or query is stored (F3b: no per-security
  count).
- **Change:** no CHECK on `surface` or `via`. Adding a code later would need `drop constraint`, which the CI schema rule
  blocks. Both are validated in code against the registry, and a db test (A3) fails on any stored value outside it.
- Day is UTC `current_date` on the server; no time of day is stored.
- `SCHEMA_MAP` entries in `lib/privacy-retention.ts`: both tables, `personal: false` for `view_drops`; `view_rollup`
  marked personal (it carries a user id), deleted by cascade and by the purge.
- Name check: `record_views` already exists (saved views). The new names do not collide.

## 4. Components and routes
| Piece | File | Notes |
|---|---|---|
| Registry | `lib/referral.ts` (block `F-15`) | Section 6. Pure. Extends, never narrows, `REFERRED_SURFACES`. |
| Pure view logic | `lib/views.ts` | `surfaceOf(pathname)`, `refClass(referrerOrigin, origin)`, `botReason(headers, body)`, `rateCap`, `recordView`, `recordDrop`. Only file that names the two tables (besides the purge and readout). |
| Beacon | `app/view-beacon.tsx` (client) | Returns `null`. `usePathname()` drives one effect per pathname: cumulative visible timer, then `fetch('/api/views', {method:'POST', keepalive:true, body})` with `{ path, ref, via, auto }`; `ref` is the class computed in the browser from the referrer's origin only; `via` read from `?via=` on the landing view only (no carry-forward: MRC2-3); `auto = navigator.webdriver === true`. All errors swallowed. |
| Mount | `app/template.tsx` (new) | `<>{children}<ViewBeacon /></>`: a fragment, so no DOM node. See Q1. |
| Route | `app/api/views/route.ts` | Same origin via `lib/discovery/origin.ts#sameOrigin`; body cap 512 bytes; bot filter in memory, user agent read and dropped; unknown path or handle → no row; signed_in/self_view from the existing session; always `204`, DB errors via `logSafe`, never surfaced. CSP already allows `connect-src 'self'`. |
| Share | `app/share-button.tsx` | New optional `via` prop; default from pure `shareVia(url, image)` in `lib/share.ts`: `/u/h` → `card`, `/u/h/month/ym` → `month`, `/u/h/trade/id` → `trade`, an image under `/story` → `story`. `withVia(url, via)` replaces any existing `via`. No caller file changes (share-prompt's story image is detected from the `image` prop it already passes). |
| Purge | `lib/privacy-purge.ts` | New `views` step: `delete from view_rollup where day < current_date - <bound>` (and `view_drops`), batched like the other steps, inside the existing time box. |
| Readout | `scripts/f15-readout.ts` | Pure `buildReadout(rows, now)` + thin IO shell (Q7). |
| Validation | `scripts/f15-bot-validation.ts` | Against a running server: 200 scripted fetches (no JS, declared-bot user agents, missing fetch metadata, automation flag, bursts) and 50 human-like visits (real browser, JS, visible ≥ 2 s). Reports dropped %, counted %, false-count rate. |

Surface map (closed, from E1): `/` feed, `/u/[h]` profile, `/u/[h]/trade/[id]` trade, `/u/[h]/month/[ym]` month,
`/t/[symbol]` ticker, `/t/compare` compare, `/login` login, `/how` how. Every other path sends nothing (the beacon
checks `surfaceOf` before sending; the route checks again).

## 5. Open questions (recommendation in bold)
**Q1 Mount point.** (a) **`app/template.tsx` rendering a fragment.** One new file, touches no F-13 file. The root
template remounts only when the first segment changes, so the beacon must key its effect on `usePathname()` anyway; the
fragment adds no DOM. Risk to check: client state below the root resets on first-segment navigations, which already
happens because the page subtree changes; e2e covers feed scroll and the pane. (b) One line per page: touches
`app/page.tsx` and `app/u/[handle]/**` (F-13's files) and is easy to forget on new pages. (c) Inside `app/layout.tsx`:
banned until F-13 merges; move there later only if (a) shows a regression.

**Q2 Retention bound.** (a) 90 days: covers the 8-week gate window with a thin margin. (b) **120 days**: the 8-week
window, a month of re-reads, matches E6's 120 days so the Privacy Policy states one number. (c) 400 days: allows
year-on-year, but holds more than any decided gate needs. Proposed in the PR; owner confirms.

**Q3 Invite segments.** (a) **`inv_t` (transparency-led recruiting segment) and `inv_h` (hobbyist)**, the two codes the
market council named (X3). Adding one is a reviewed code change. (b) Numbered `inv_1..inv_9` with the meaning kept by
the owner: flexible, but invites one code per person, which breaks "a class, never a per-person id". (c) Four codes
adding generic channel buckets: premature, no segment decided.

**Q4 Is `story` its own class?** (a) **Yes, `story`**: the story image is a different format with its own G3 split and
costs nothing extra (detected from the `image` prop). (b) Fold into `card`: loses the format split the council asked for.

**Q5 Rate cap.** (a) **In-memory per-instance window: key = hash of client address + user agent with a random salt made
at boot and rotated hourly; 20 beacons per key per minute; map capped at 10,000 keys (oldest evicted); never logged or
stored; excess → drop reason `rate`.** (b) Per target per minute only: no viewer data at all, but one scraper can still
inflate a profile up to the cap. (c) No cap: simplest, but the 95% bar then rests on the user-agent check alone.
Ponytail: per-instance, so N instances allow N× the cap.

**Q6 Store a drop rollup?** (a) **Yes, `view_drops` (no user id, same retention)**: lets each readout tell an
instrument change from a traffic change and gives the false-count rate in weeks 1-8, not only at validation. (b) No:
the validation script computes its own rates; nothing in production shows filter drift.

**Q7 Readout cadence and format.** (a) **Weekly, run by the owner:
`node --env-file=.env scripts/f15-readout.ts --out <dir>`; refuses any `--out` that resolves inside the repo; writes one
plain-text/Markdown table per week (weeks as columns), each gate row with the DESIGN §3.5 threshold verbatim beside it.**
(b) A cron job writing the file: needs a place outside the repo on the server; no gain at this volume. (c) An owner page
in the app: rejected, the feature bans any `app/` page reading the rollup. Email is out (F3b, COMPLIANCE §5).

Readout rules (all from the feature file): G1 strict; G2 "after the share_action slice"; G3 "views, not people", strict
DESIGN cut (profile surface, external referrer, not self-view) printed first, the tagged and trade/month splits beside
it labelled partial; G4 "strict G4 can't be read in this slice; signed-out D7 return is not measured", plus at most a
count labelled "signed-in viewers only"; demo users excluded through a join, never printed; no handle, user id or
return; any path × via × day cell < 5 rolls into "other".

## 6. The via registry (exact, `lib/referral.ts`)
- Share classes: `card`, `trade`, `month`, `story`.
- CTA surfaces (`REFERRED_SURFACES`, already): `profile`, `trade`, `month`, `nav`.
- Invite codes: `inv_t`, `inv_h` (Q3). Added to `REFERRED_SURFACES` too, so sign-up attribution keeps them.
- Path codes (`PATH_CODES`, for `META_KEYS.method_chosen = ['method','path']` in `lib/funnel.ts`): `publish`, `follow`.
- `VIA_CODES` = share ∪ CTA ∪ invite, plus `none`. `normalizeViewVia(raw)` → a code or `none`; matching is exact after
  trim + lowercase; anything else is dropped to `none`. `trade`/`month` appear as both a share class and a CTA surface;
  the stored surface disambiguates (a CTA lands on `login`, a share on the record page).

## 7. Test plan (every acceptance criterion)
| # | Criterion | Test (file) |
|---|---|---|
| A1 | Deleted with the profile; rename does not carry counts | db: `lib/f15-views.db.test.ts`: rows for A, `deleteProfile` → zero rows for that user id. Rename A→B, new user A → zero rows under new A's id, no table column holds handle text (old rows stay with the original id only). |
| A2 | No IP, UA, viewer/session id, cookie, fingerprint | db: same file: `information_schema.columns` of every F-15 table equals an exact allow-list, and no column name matches `ip|agent|ua|viewer|session|cookie|finger|referrer|path|query`. |
| A3 | Closed registry; unknown dropped | unit `lib/f15-referral.test.ts` (unknown → `none`, case/whitespace); db: `select distinct via, surface` after a fuzz of 200 random bodies ⊂ registry. |
| A4 | Referrer stored only as a class | unit `lib/f15-views.test.ts`: `refClass` returns only the 3 classes; route test posts a full referrer URL and the row holds only a class. |
| A5 | `SCHEMA_MAP`, cookie test, log scanner | existing `lib/privacy-retention.test.ts`, `lib/privacy-cookies.test.ts` and the log scanner pass with no new exception; PR answers §1 Q2. |
| A6 | Additive schema | existing CI schema rule + `lib/f15-views.db.test.ts` asserts the four `users` share columns still exist. |
| A7 | No page or `lib/feed.ts` reads the rollup | unit `scripts/f15-isolation.test.ts`: scans `app/**` and `lib/feed.ts` for the table names and for imports of `lib/views.ts`; only `app/api/views/route.ts` may import it. |
| A8 | No cell < 5 | unit `scripts/f15-readout.test.ts`: fixture with cells of 1-4 → every printed cell ≥ 5 or "other". |
| A9 | Readout text | same file: the four §3.5 lines verbatim; the G4, G2, G3 and "signed-in viewers only" strings. |
| A10 | Writes outside the repo; no handle or return | same file: `--out` inside the repo throws; output on a fixture with handles and returns contains neither (regex for `@`, `%`-returns, known handles). |
| A11 | Bot validation 200/50 | `scripts/f15-bot-validation.ts` run; result table in the PR (owner item 4 for real devices). |
| A12 | 50 concurrent beacons → one row, n = 50 | db: `lib/f15-views.db.test.ts`, `Promise.all` of 50 `recordView`. |
| A13 | Route 500 / DB down → page fine | e2e `e2e/f15-beacon.spec.ts`: route intercepted to 500, and a run with the write forced to throw; page 200, no error text, Share still works. |
| A14 | No focusable element, no UI, no layout shift, no paint delay | same e2e: tab order and accessibility tree identical with and without the beacon; CLS 0 from a layout-shift observer; DOM snapshot of `body` unchanged after 3 s; first beacon request starts ≥ 2 s after load. |
| A15 | Purge past the bound | db: `lib/f15-purge.db.test.ts`: `purgePrivacy({ only: ['views'], now })` removes day < bound, keeps day = bound. |
| A16 | `?via=` on Share and copy-link, one tap, polite live region | unit `lib/f15-share.test.ts` (`shareVia`, `withVia`); e2e `e2e/f15-share.spec.ts` at 360px: one click → clipboard has `?via=card` / `month` / `trade`; the `aria-live="polite"` region reads "Link copied". |
| A17 | Nav, invite, path codes accepted | unit `lib/f15-referral.test.ts`. |
| A18 | `share_action` rows | deferred to the post-F-13 half; listed in the hand-off note. |
| A19 | No `app/layout.tsx` edit | review: `git diff --stat main` shows no `app/layout.tsx`. |
| A20 | Ponytails marked | review + hand-off note (section 11). |

## 8. COMPLIANCE §1 answers
1. Performance: no. Nothing shown, ranked or labelled; counts never feed ordering (A7).
2. Personal data: yes. Fields: day, surface, target `user_id`, ref class, via class, signed-in flag, self-view flag,
   count. Location: Postgres `view_rollup` / `view_drops`. Visible to: the owner only, through the readout. Deletion:
   cascade on profile delete, purge after the bound. IP and user agent are read in memory for the filter and rate key,
   never stored or logged. Needs the Privacy Policy text before real users (owner item 1).
3. Money: no.  4. Tracking: yes, first-party aggregate counting only; no third-party script, pixel, cookie, device
   storage or session replay; no email or push. Section 5 met by design; disclosed in the Privacy Policy.
5. User text: no.  6. Accounts: no change (invite codes are attribution only and gate no access).
7. Vendor/dependency: none.  8. Accessibility: no new UI; the polite live region is kept and tested (A16).
9. Security: one new public endpoint: same-origin only, body cap, rate cap, always 204, no data returned.
10. Claims: none; the readout is internal and descriptive.

## 9. Owner items
1. Privacy Policy text describing this flow (P6) before any real user; this build may merge and run on demo/test data.
2. MRC2-3 (gate definitions): until ruled, the readout prints strict DESIGN numbers and labels the rest partial.
3. Confirm the retention bound (proposed 120 days).
4. Real-device validation of the bot filter: the scripted 200/50 run is in the PR; previews from real messaging and
   social apps can only be checked by the owner on real devices, before week 1, result added to the PR.

## 10. Pre-authorization requests
None. No new dependency, vendor, font or protected path; no secret; no counsel item beyond the Privacy Policy text.

## 11. Known limits (`ponytail:` in code, listed in the hand-off note)
- Rate cap is per instance (Q5); next step: a shared counter if the instance count grows.
- `via` is read on the landing view only; carrying it across internal navigation waits for MRC2-3.
- Pages that render without JS, or close before 2 s, are not counted; the readout says "views, not people".
- `share_action` rows (E5) and G2 wait for F-13; next step: the second half of this feature.
- Mount in `app/template.tsx`; next step: move into `app/layout.tsx` after F-13 if a regression shows.
- UTC day boundary; next step: none planned (descriptive weekly totals).

## Round 2 revisions (orchestrator, after business lead round 1 D1-D10 and engineer round 1 E1-E14)
Every demand is accepted; the plan changes as follows.
1. **Validation (BL D1, EN E1).** `scripts/f15-bot-validation.ts` runs four scripted groups totalling 200: 50 no-JS page
   fetches with declared-bot agents (reported apart, labelled "cannot send a beacon"), 50 headless JS visits with
   `navigator.webdriver` true, 50 headless JS visits with the automation flag hidden plus a declared-bot agent, and
   50 forged direct POSTs (declared-bot agents, no fetch metadata, forged cross-site Origin, bursts). The 95% drop bar is
   reported on all 200 and on the 150 JS/POST subset alone, each drop reason apart, with and without the `rate` rule.
   The 50 human-like visits run a real browser with the automation flag hidden (stated as a known bias: the rule is a
   speed bump, not a wall); they stay on the page 2.5 s. Owner item 4 (real devices) stays.
2. **G4 (BL D2).** No signed-in count in this slice: the readout prints only the fixed G4 line.
3. **G1 (BL D3).** Strict G1 = distinct non-demo, non-deleted users with a connection in state `connected`; users whose
   only connections are not `connected` (frozen or failed) print on a separate row labelled partial. Db test with a
   demo user, a non-connected one and a connected one.
4. **Rate cap (BL D4, EN E14).** 60 per key per minute; unit test: 30 a minute all counted, the 61st dropped. The
   address comes from `lib/rate-limit.ts#clientIp` (trusted proxy header only; null otherwise → key from the user agent
   only, ponytail). A source test asserts no console/logSafe call in the route or `lib/views.ts` takes the key, address
   or user agent.
5. **Fetch metadata (BL D5, EN E14).** Cross-site (`sameOrigin` false with a header present) → 403, nothing counted.
   Only a request with neither `Sec-Fetch-Site` nor `Origin` is dropped as `no_fetch_metadata`. Unit test: Origin-only
   same-host request is counted.
6. **Template (BL D6, EN E13).** e2e: feed scroll position and the open card survive opening/closing the pane; the full
   e2e suite passes unchanged; soft nav /u/a → /u/b sends one beacon each; effect cleanup cancels, never sends on
   unmount; `content-type: text/plain`.
7. **Small cells (BL D7, EN E10).** Every printed cell (day or week, "other" included) under 5 prints "<5"; when exactly
   one cell in a row is suppressed, the next-smallest is suppressed too (complementary); totals are printed only for
   rows with no suppressed cell or as "≥ n". A8 covers a one-small-cell fixture.
8. **Drops surface (BL D8, EN E5).** `view_drops.surface` = a counted surface or `other`; no CHECK on `reason` (validated
   in code + db test), consistent with surface and via.
9. **Body validation (BL D9).** `ref` outside the three classes → beacon refused (not counted); `auto` only `true` counts
   as set; trade page with a valid handle but no such closed trade → no row; month needs `YYYY-MM`.
10. **G3 order (BL D10).** Strict (profile, external, not self-view, non-demo target) first; then partial rows: `via` ≠ none
    split card/story, trade/month, invite; trade and month surfaces; plus the line "Signed-out owner views can't be told
    from other views."
11. **Upsert (EN E3).** Insert with n = 1; conflict target equals the unique index's columns.
12. **Purge (EN E4).** `${now}::date - VIEW_RETENTION_DAYS`; ctid batches; `'views'` added to `PurgeStep`, `views` to the
    report.
13. **Story (EN E6).** `story` only when the share sheet takes the picture (`files` mode); copy and link-only shares are
    classed by path; the link is built at click time.
14. **Existing e2e (EN E7).** `e2e/app.spec.ts` lines asserting the copied link change to the exact tagged URL
    (`?via=card`), never loosened; listed in the hand-off as shared-file edits.
15. **Rename (EN E8).** The test asserts the literal wording as far as it is consistent: no column holds handle text, so
    nothing is found under the text "A" or "B"; the new user A has zero rows; the old rows stay keyed to the original id
    (they belong to the same account). The reading is a committee decision, recorded and raised for the owner.
16. **Readout guard (EN E9).** `realpath` of the nearest existing ancestor of `--out` and of the repo root, `path.relative`
    must start with `..` and not be absolute-equal; `--out` required. A10 tests a symlink into the repo and a sibling
    folder sharing the prefix.
17. **Route seam (EN E11).** Handler logic in `lib/views-route.ts#handleBeacon(req, deps)` with injectable writers (route
    files may only export HTTP methods); unit test: the writer throws → 204 and one `logSafe` line with no agent or
    address. e2e covers the route-500 case with `page.route`.
18. **A14 (EN E12).** DOM and accessibility snapshot right after load equal those after the beacon fired; no request
    before 2 s visible (timestamps); a page kept hidden 3 s sends nothing.

## Sign-off (round 2)
- Business lead: SIGN with R1 — with no trusted client address the rate rule is skipped (never keyed on the user agent
  alone); unit test: 100 beacons with no address and one agent are all counted. Accepted. Optional `bad_body` drop
  reason: declined (refused bodies are not beacons; keeps the reason list to filter outcomes).
- Engineer: SIGN. Notes taken: the validation runs the human group first and waits out the rate window between groups;
  A10 includes `--out` equal to the repo root.
- UX lead: author of the plan; revisions keep every screen decision (no visible UI, Share one tap, polite live region).
