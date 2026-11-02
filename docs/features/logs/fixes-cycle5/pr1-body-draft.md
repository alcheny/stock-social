Cycle-5 fixes list, part 1: `docs/direction/cycle5-2026-11-01.md` section 5, items F5-2 and F5-4..F5-27 (F5-1 and F5-3
moved to the approval ballot and are not built). Part 2 (the five items approval council 5 routed to the fixes lane)
follows as a second PR. Committee record: `docs/features/logs/fixes-cycle5/committee-2026-11-01.md`; legal committee:
`docs/features/logs/fixes-cycle5/legal-committee-2026-11-02.md`.

## What changes

**Data and performance**
- **F5-2 (C5-3), the data-loss fix.** Notes and reports are keyed by the trade's `trade_key` (sha256 of the sell id),
  which survives every rebuild; the row id is kept only as a fallback.
  - `saveThesisFor` locks `(user_id, trade_key)`. If a concurrent rebuild deleted the row while the save waited, it
    reads once more and finds the rebuilt row.
  - If the trade has left the record, nothing is written. The author sees "Your note was not saved because this trade
    changed." (role=alert, focused), plus a recovery box holding the unsaved text. The box is shown in the author's own
    tab only, from sessionStorage, and the text never goes into a URL or a log.
  - Reports take #100's `TRADE_KEY` lines byte for byte. The profile, feed card and trade page post the key.
- **F5-4 (C5-6).** `/t` and `/t/SYMBOL` read a new `ticker_trader_sums` table, with primary key `(symbol, user_id,
  verified)`.
  - Statement-level triggers maintain it, and a rebuild defers them, then recomputes once per trader.
  - Hidden and deleted users are filtered at read time, and filings are excluded.
  - The "other stocks" baseline is summed in JS, never computed as a total minus this symbol.
  - Totals are cached per 60 s bucket only in the deployed app.
- **F5-5 (C5-7).** The feed's page-1 lists live in a single-flight LRU cache (`lib/bucket-cache.ts`, 256 entries; a
  failed build is evicted). Page 1's `asOf` is floored to a 60 s bucket on the database clock when
  `VERCEL_ENV=production` or `FEED_BUCKET_MS` > 0; with `FEED_BUCKET_MS=0`, behaviour is exactly as on main.
- **F5-14 (C5-12).** A heavy profile sends a bounded chart series. Past 5,000 points per range, each time slice keeps
  its first, last, lowest and highest point. Every printed figure is computed from every close.
  - 80,000 fictional closes: HTML went from 458,297 to 94,833 bytes gzipped (at the first budget of 2,000). At the
    final 5,000 the chart alone is 146,567 bytes gzipped (it was 415,118), and the whole page is under the 300 KB e2e
    bound.

**Correctness and ops**
- **F5-8.** Rebuild and options paging keep microseconds (`::text::timestamptz`).
- **F5-15.** Vendor positions are read before the rebuild's locks; the writes stay inside its transaction.
- **F5-16.** Two DB test files delete what they create. A proof test runs each suite twice in a private schema.
- **F5-17.** The deploy rebuild logs `{count, byClass}`, with error classes only.
- **F5-18.** Pending deletions: at most 5 per call, oldest untried first, each started only inside the deletions'
  own budget (two vendor timeouts, so the sync keeps the rest of the call). A failure backs off from 1 minute up to
  24 h, and nothing is dropped.
- **F5-19.** No `X-Powered-By` header.
- **F5-20.** A production start warns once when `SESSION_SECRET` is missing or equal to `APP_SECRET_KEY`. With
  `SESSION_SECRET_REQUIRED=1` it throws. `lib/session.ts` is untouched.
- **F5-27.** One definition of the symbol index, now named `closed_trades_symbol_recent`.

**Copy and accessibility**
- **F5-6.** The connect line, as signed by the legal committee: "Every account under this login, except simulated ones,
  and the full trade history your broker provides are included. No trades are imported until you confirm on the next
  screen."
- **F5-7.**
  - The email error reads "Enter a full email address, like name@example.com.", the field is focused and keeps its
    value, and a rate error focuses its alert.
  - Owner Q2: the 18+ tick survives an email error, under the legal committee's conditions A1-A12. It is carried by a
    30 s, path-`/login`, httpOnly, sameSite=lax cookie, set only on the email-error redirect. `proxy.ts` clears it on
    every other `/login` request.
  - The attestation is still read only from the submitted field, and the cookie has a `COOKIE_TABLE` row.
- **F5-9.** The /me/record takeaway names both sides ("…; 3 losses, too few to average.") and prints a true minus
  (legal condition B16).
- **F5-10.** A gain is never "Worst trade" ("Highest return" / "Lowest return"), and a two-trade month shows no picks.
- **F5-11.** The profit factor is cut to two decimals, never rounded up, so 0.997 prints "0.99".
- **F5-12.** The chart's date keeps "Nov 1" together with a non-breaking space.
- **F5-13.** An empty stock page is titled "No closed trades in ‹TICKER› yet · Stock Social"; the 200 and noindex stay.
- **F5-21.** The hide bar's Undo lasts 20 s and pauses while the reader is on it. A Dismiss control (✕, accessible
  name "Dismiss") sends focus where the timeout does. "Show again" focuses its status line.
- **F5-22.** Rule forms move focus to the rule's heading with "Rule set: …" / "Rule cleared.", and "tap to clear" is
  gone.
- **F5-23.** Delete step 1 focuses its "cannot be undone" alert.
- **F5-24.** The note field is a 3-row textarea with the visible label "Your note" and the name "Your note on ‹SYM›". It
  shows "‹n› of 280", announces only at 20 left and at the limit, and says when a paste was cut. The held-note edit link
  lands on the field by trade key.
- **F5-25.** Static failed-import notices drop their live-region role (the F3-16 ruling); live notices keep it.
- **F5-26.** `autocomplete="username"` on the handle field.
- **Owner decision 2026-11-02.** The held-sells line reads "N sells excluded while a possible duplicate is checked."

## Decisions

Every decision is recorded in the committee record with "Why: decided by the committee under the owner's instruction
of 2026-11-01; …".
- Plan rounds 1-3: UX lead plan; business lead and engineer reviews; signed in round 3.
- The legal committee confirmed every copy item and the Q2 mechanism with conditions, rewording F5-6 and the MK-P6
  sentence.
- Notable choices:
  - The F5-5 gate depends on `VERCEL_ENV`, never on `ALLOW_DEV_AUTH`.
  - F5-25 follows F3-16 over F-27's "role stays as today".
  - F5-14 was un-deferred once F-23 merged, and its budget was raised from 2,000 to 5,000 after the full e2e run showed
    the dense-profile decisions (F-23's 4,700-close compact form, fix round 4's 2,828 reachable closes, fix round 8's
    > 4,000 points) need full resolution there.
  - The F5-21 Dismiss control is an icon with a text name, so the bar stays inside its 94 px room at 360 px.

## Testing

- `npx tsc --noEmit`: pass.
- `npm test` (database env exported, final head, after merging main at eb2a649 with #100, #102, #107, #108): 2,615
  tests, 2,587 pass, **0 fail**, 26 skipped (LOAD), 2 todo (existing owner items).
- `BASE_REF=main node scripts/compliance.ts auto`: ok. `node scripts/autopilot.ts guard origin/main`: ok.
- `npm run build`: pass.
- Full `npx playwright test --workers=1`: 360 passed, 6 skipped, 5 failed. Each failure was this cycle's change against
  an existing pin, fixed as follows:
  - **3 failures (dense-profile pins):** fixed by raising F5-14's budget (`lib/chart-bounded.ts`).
  - **2 failures (selector-equivalent edits):**
    - `e2e/app.spec.ts:554`: no textarea other than the owner's note fields (and none in the Share card).
    - `e2e/connect.spec.ts:447`: the same text on `p.record-failed:not([role])`, which adds the F5-25 rule.
  - **Rerun of the failing and touched specs on a rebuilt app:** after the fixes, the 6 failing or touched specs (111 tests) passed except this cycle's own held-note e2e, which pinned the bug review item 2 fixed; corrected, and app, f23-display, fixes-cycle5-notes and fixes-cycle5-chart then 69/69 on the final build
- `LOAD=1 node --expose-gc --test lib/sync.load.test.ts`: 5/5 (the lines are in the WP2 and WP3 reports in the build
  log).
- Measured, not wall-clock:
  - F5-4: at 20,000 closes no ticker statement does a Seq Scan on `closed_trades`, and each read of it touches at most
    51 rows. Deferred inserts read 0 rows, and `finishTickerSums` reads exactly the trader's 600 rows.
  - F5-5: 50 concurrent loads give one build.
  - F5-2: a save blocked by a rebuild is stored after the commit; the test waits on `pg_blocking_pids`, not a clock.

**Existing tests edited (each equal-strength or stronger):**
- `lib/f27-colour-follow-ups.test.ts:107,136,148` and `lib/qa-round-1.test.ts:35`: the role is absent on static uses
  and present on live ones.
- `lib/f26-held-like-none.db.test.ts:151-154,174` and `e2e/f26-held-like-none.spec.ts:305-316`: `#note-<key>` links,
  plus `toBeFocused`.
- `e2e/f7-public-profile.spec.ts:117`: `[name="thesis"]`.
- `lib/user-note.test.ts:98,113` and `lib/report-copy.test.ts:30-31`: #100's identical hunks.
- `lib/ticker-review.test.ts:125`: the ponytail pin becomes the fix marker, and the plan-shape test is the stronger
  proof.
- `e2e/follow.spec.ts:227` and `e2e/likes.spec.ts:332`: the new 20 s hide bar.
- `e2e/record-strip.spec.ts:200`: the normalizer adds Highest/Lowest return.
- `e2e/signin.spec.ts:248`: `toContainText` becomes an exact `toHaveText`.
- `e2e/f24-excluded-held.spec.ts:46`: a literal pin of the owner's wording.
- `lib/chart-sub.test.ts:12-13`: the exact strings with ` `.
- `lib/privacy-cookies.test.ts:60`: the new cookie's known lifetime.
- `lib/trades-prompt.db.test.ts`, `lib/f15-share-action.db.test.ts`: `after` cleanup only.
- `e2e/app.spec.ts:554`, `e2e/connect.spec.ts:447`: see above.

**Not run (owner instruction 2026-11-02, token saving):**
- The tester's QA loop and the 360 px user test by the business lead and the UX lead were not run.
- The independent code review did run on the whole diff: 0 blocking findings. Its should-fix items 1-4 and nit 5 are
  fixed (a deletion budget, a held note keeping its count, the records, the alert after a later save). Nits 6-8 became
  ponytails or comments.

## Compliance

COMPLIANCE Section 1:
1. **Performance shown, ranked or described?** Yes, labels only; ranking is unchanged.
   - F5-10, F5-11 and F5-13 make labels truthful: no gain reads "Worst", no ratio below 1 reads "1.00", an empty stock
     page claims no trades.
   - F5-9 names both sides, and losses read like gains: one producer, with symmetric tests.
   - The disclaimers are unchanged on every performance surface. No advice words, and no completeness claim: F5-6
     removes "your full trade history".
2. **Personal data?** Yes, minimal.
   - Two `users` columns: `deletion_attempts` and `deletion_next_at` (deletion backoff), removed with the user.
   - One aggregate table, `ticker_trader_sums`: per-trader sums with no text. It cascades with the user, it has a
     `SCHEMA_MAP` entry, and its reads go through the visible-user filter. The 60 s cache can keep a just-hidden profile
     inside aggregate counts for one bucket, with no identity.
   - One cookie (the 18+ tick): 30 s, path `/login`, no identity, a `COOKIE_TABLE` row.
   - The F5-2 unsaved note stays in the author's own sessionStorage and is never sent.
3. **Money?** No.
4. **Email, push or tracking?** No.
5. **User-written text?** Yes: notes.
   - Moderation is unchanged; a held note stays held.
   - A save never lands on another trader's trade, because `user_id` comes from the session.
   - The unsaved-note text goes back only to its author, never into a URL, cookie or log (legal 2c).
6. **Sign-up or age?** Yes: F5-7.
   - The 18+ tick surviving an email error is owner Q2, confirmed by the legal committee under conditions A1-A12. The
     attestation is recorded only from the submitted field, no URL can pre-tick the box, and the box state is
     announced.
   - This is not age assurance; the 2027 dates stay open.
7. **Vendor, dependency, asset or copied text?** No new dependency and no third-party name. All code and copy are
   original.
8. **Screen reader and keyboard?** Yes: F5-7, F5-21, F5-22, F5-23, F5-24 and F5-25 are WCAG 2.2 fixes for focus order,
   labels, timing and live regions, each tested in e2e.
9. **Security posture?** Yes.
   - F5-19 removes `X-Powered-By`.
   - F5-20 enforces a separate session secret behind an owner switch.
   - The F5-2 redirect is built from the handle, a 64-hex key and a numeric window only: no open redirect.
   - Protected files are unchanged.
10. **Claims?** None. The legal committee re-signed the F5-6 and F5-7 copy.
11. **Checkout?** No.

## Known limits

The ponytails added in code:
- **F5-14:** past 5,000 points per range, scrubbing steps only through the kept closes. The rest are reached through
  the paged list.
- **F5-4:**
  - A deferred rebuild still captures its inserts in the transition table.
  - A trigger write re-reads the trader's closes in each touched symbol.
  - The totals cache is per process.
  - `/t` brings one row per symbol to the server.
  - The backfill re-scans when there is no countable row.
  - The stock image keeps its old full-scan ponytail.
- **F5-5:** the cross-server "same list" holds only for committed rows, and the list cache is per process.
- **F5-7:** without JavaScript, the box comes back unticked and the error asks for the tick again (the compliant
  fallback).
- **F5-9:** the true minus applies to this takeaway only; the site-wide sweep is F-19's.
- **F5-18:**
  - The backoff is per user.
  - A deletion cut at the deadline keeps running after the response.
- **F5-21:** at 320 px the longest message wraps to a third line.
- **F5-24:** the note form uses inline layout styles until a `.note-form` CSS block exists.

## Owner items

1. **CLAUDE.md, Commands** (protected): replace "fill APP_SECRET_KEY and CRON_SECRET with random strings" with "fill
   APP_SECRET_KEY, CRON_SECRET and SESSION_SECRET with distinct random strings".
2. **`.github/workflows/ci.yml`** (protected, council owner Q4): a row-count check around `npm test`, merged only once
   every suite cleans up after itself. Before `npm test`: `psql "$DATABASE_URL" -Atc "select string_agg(relname || '=' ||
   n_live_tup, ',' order by relname) from pg_stat_user_tables" > /tmp/rows-before.txt`. After it: `psql "$DATABASE_URL"
   -c analyze`, the same query into `/tmp/rows-after.txt`, then `diff /tmp/rows-before.txt /tmp/rows-after.txt`.
3. **F5-27 on upgraded databases.** Before deploy: `create index concurrently if not exists closed_trades_symbol_recent
   on closed_trades (symbol, closed_at desc, id desc);`. After it: `drop index if exists closed_trades_symbol;` (a
   `drop` fails the schema guard, so it can't live in `db/schema.sql`).
4. **F5-4 backfill.** On an upgraded database, the first schema apply runs one grouped scan of `closed_trades` while
   writes are locked out, so run `node --env-file=.env scripts/db-setup.ts` in a quiet window.
5. **Deploy env.**
   - A distinct `SESSION_SECRET` of at least 32 characters.
   - `SESSION_SECRET_REQUIRED=1` once launch row 5 is signed off.
   - Optionally `FEED_BUCKET_MS` (on by default under `VERCEL_ENV=production`).
6. **Note:** F5-25 departs from F-27's "role stays as today" under F3-16's ruling. No action is needed.
7. **For the 2.32 session:** "Based on 4,731 trades. Too early to tell." will read as wrong to a high-volume trader
   (part 2's business lead flag).

## Merge notes

- **Commits:** all by `124938909+alcheny@users.noreply.github.com`; main is merged in, never rebased.
- **Main merged at eb2a649:** #100 (F-16/F-17), #102 (F-25), #107 (the chores lane's matcher catch-up), #108 (F-32 Part
  A). Eleven conflicts, each resolved as follows:
  - `lib/reports.ts`, `lib/trade-share-load.ts`, `app/feed-rows.tsx`, `lib/user-note.test.ts`: main's lines, which
    already carry the same trade-key change.
  - Profile page:
    - imports from both sides;
    - #100's visible handle label, plus F5-26's `autoComplete`;
    - this cycle's note textarea, with #100's held spread byte for byte;
    - the Report control passes `t.trade_key`.
  - `proxy.ts`, `lib/copy.ts`, the month page: both sides kept.
  - `lib/sync.ts`: F-32's `excluded_transfer` write, then this cycle's `finishTickerSums` return.
  - `lib/matcher-rebuild.ts`: #107's `rebuildEach` refactor, with F5-17 re-applied inside it. Each failure is counted
    by class in both the deploy rebuild and the catch-up logs, and the `rebuild` seam is the 5th parameter.
  - `e2e/f26-held-like-none.spec.ts`: main's version, whose `key` field matches.
- **Existing tests edited for the merge:**
  - `e2e/f4-17-held-field.spec.ts` (#100): the field's new name "Your note on ‹SYM›". The description is the count plus
    the held reason, and a published note's field is described by its count alone. Same checks.
  - `lib/f17-normaliser.test.ts` (#100): the `/t` search's ticker parse is asserted along its new path,
    `filterTickerIndex(all, q)` and then `normalizeSymbol(q)`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8mrMYGH4nymC7SmJfh
