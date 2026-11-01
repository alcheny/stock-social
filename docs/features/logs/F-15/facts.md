# F-15 build: fact sheet for the committee (orchestrated build session, 2026-11-01)

Read with `docs/features/F-15-measurement-foundation.md` (the owner's decisions and acceptance criteria) and
`docs/direction/market-2026-11-01-cycle2.md` §3.1 (event dictionary E1-E5) and §3.2 (gates).

## Scope of this slice
- In: E1 view rollup (beacon, bot filter, 2 s visible), a drop rollup for the bot-filter validation (E2-like), one
  closed `via` registry (share classes, CTA surfaces incl. `nav`, invite codes, `path` codes), `?via=` on Share and
  copy-link, retention purge on the existing cron path, owner-only weekly readout script, bot-filter validation run.
- Out (start condition): `share_action` rows (E5) wait for F-13 (#55) because they edit `app/u/[handle]/share-prompt.tsx`
  and `lib/display-log.ts`; the readout prints G2 as "after the share_action slice".
- Out (feature file): E4 device-storage date, E8 painted door, gate redefinitions (MRC2-3), any count shown to traders.

## What exists today (main 3f216ba)
- `app/api/events/route.ts`: F-2's opt-in activity log route (signed-in, opted-in only). Not touched.
- `lib/discovery/origin.ts#sameOrigin`: same-origin check on Sec-Fetch-Site / Origin (reusable).
- `lib/csp.ts`: `connect-src 'self'` already, so a same-origin beacon needs no CSP change.
- `lib/referral.ts`: `REFERRED_SURFACES = ['profile','trade','month','nav']` (nav added by fix #28), `normalizeVia`,
  `ctaVia` (fallback 'profile'); stored in `users.referred_surface` (no CHECK) at sign-up. Labels in
  `app/u/[handle]/referral-feedback.tsx` (unknown keys skipped).
- `lib/funnel.ts#META_KEYS.method_chosen = ['method']`; MR2 fix-up asks for a `path` key (publish | follow).
- `app/share-button.tsx`: the only share control (sheet, or copy; "Link copied" in an `aria-live=polite` span).
  Callers: `app/u/[handle]/share-card.tsx` (profile and month recap), `app/u/[handle]/share-prompt.tsx` (profile, story
  image; F-13/share_action half owns it), `app/u/[handle]/trade/[sellId]/trade-share.tsx` (trade).
- `lib/visible-users.ts#visibleUser`: one rule for which users appear on public aggregates (deleted_at is null).
- `lib/privacy-purge.ts#purgePrivacy`: the existing cron purge (sync tick, `app/api/sync/route.ts`), batched, time-boxed,
  steps selectable with `only` (test hook).
- `lib/delete.ts#deleteProfile`: first transaction removes rows naming the account; `users` row delete cascades.
- `lib/auth/attempts.ts#changeHandle`: rename.
- DB: Postgres 17 in prod/compose; 16 locally; `unique nulls not distinct` available (PG15+).
- Owner of other files in flight: F-13 #55 (app/layout.tsx, app/u/[handle]/**, app/page.tsx, lib/copy.ts), F-7, F-10/12,
  F-11. Shared-file edits stay additive in a block named F-15.

## Engineer's first technical sketch (for the plan to accept, change or reject)
1. Tables (additive `db/schema.sql` block "F-15"):
   - `view_rollup(day date, surface text check in (...), user_id int null references users on delete cascade,
     ref_class text check in ('internal','external','none'), via text not null default 'none', signed_in bool,
     self_view bool, n int)`, unique nulls not distinct over every column but n; one upsert per beacon.
   - `view_drops(day, surface, reason text check in (...), n)`: counts of beacons dropped by the filter (for the
     validation and the false-count rate). No user id.
2. Beacon component `app/view-beacon.tsx` (client): after 2 s cumulative visible per page path, one
   `fetch('/api/views', {method:'POST', keepalive:true})` with `{ path, ref, via, auto }`; ref class is computed in the
   browser from `document.referrer`'s origin vs `location.origin` (the full referrer never leaves the browser); soft
   navigations are `internal`; `via` read from `?via=` on the landing view only (no carry-forward: MRC2-3 is the owner's);
   `auto` = navigator.webdriver. Renders nothing (returns null). Errors swallowed.
3. Mount without editing `app/layout.tsx`: a new `app/template.tsx` (Next.js template: re-rendered per navigation, adds
   no DOM node) rendering `{children}<ViewBeacon />` — or one line per page. Committee to pick.
4. Route `app/api/views/route.ts`: same-origin only, tiny body cap; bot filter in memory (declared-bot tokens in the
   user agent; missing fetch metadata; automation flag; an in-memory per-instance rate cap whose key is never stored);
   path → surface (+ handle → visible user id), unknown path/handle → drop; `via` through the registry (unknown → 'none');
   signed_in/self_view from the existing session; always 204, DB errors logged with `logSafe`, never surfaced.
5. Registry in `lib/referral.ts` (one closed list): share classes `card`, `trade`, `month`, `story`; CTA surfaces incl.
   `nav`; invite codes `inv_<segment>` from an enumerated list; path codes for `method_chosen.path`.
6. Share: `ShareButton` appends `?via=<class>` derived from the shared path (profile → card, trade → trade, month →
   month; story image → story) unless a caller passes one; the canonical/og:url stays unchanged.
7. Purge: a `views` step in `purgePrivacy` deleting rollup/drop rows older than the retention bound (proposal needed).
8. Readout `scripts/f15-readout.ts`: owner-only, writes outside the repo, pure `buildReadout(rows)` unit-tested: strict
   §3.5 thresholds verbatim; cells < 5 rolled into "other"; no handle, no user id, no return.
9. Validation `scripts/f15-bot-validation.ts`: 200 scripted preview fetches + 50 simulated human visits against a running
   server, reports dropped %, counted %, false-count rate.
