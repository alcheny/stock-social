# F-1 PR-2a fix round 3 (engineer)

Date: 2026-10-23. Branch `claude/adoring-euler-4469ys`, from `141f5bd` (tester re-run 2 in `test-pr2a-tester.md`).

## Fix round 3 plan

The Medium is a trust-rule failure (TR-3 full history, TR-2 / the meaning of Verified): one trader can hold several
connections, and two reads took a single "latest" one. Fix the model once and route every reader through it.

1. **Medium + Low 2, one aggregate over all connections.** A pure `aggregateRecord(rows, legacy)` in
   `lib/connections.ts` derives the trader's record state from every consented connection (`consent_at` set):
   `importing` while any is importing; else `failed` if any consented import failed (and no later live connection
   re-imports all of its real accounts, so "Try again" can clear it); else `connected` when every remaining consented
   connection is connected; else `connected` for a pre-F-1 claim, else `none`. Pending, declined and expired rows never
   count. `recordStatus(userId)` reads the rows and returns the state, the summed import count and the ids of every
   importing connection; `publicRecord` (profile, card) is built on it.
   - `POST /api/import/step` runs one step for **every** importing connection of the session user (not the newest
     row), then answers the aggregate: `state` as above (`none` when nothing is consented, never `pending` from an
     unrelated link), `imported` summed, `closes`. The tick already drives every importing row; unchanged.
   - While the record is `importing`, the profile shows the banner and the closed trades so far, but no Verified badge,
     no headline stats, no chart and no "Connected: …" line; the page metadata (link unfurl text) says the record is
     importing instead of quoting stats; the feed leaves out traders with an importing connection.
   - Tests: DB test, the tester's repro (3-account import running, a second link consented → still `importing`; the
     poll advances both; after the tick, 7 closes and `connected`); DB test with a newer pending link (poll never
     says `pending`, advances, ends `connected`); unit test of the aggregate state matrix; e2e of the repro in the
     browser (banner present and no Verified badge/stats signed out until both finish).
2. **Low 3, share card states.** One pure `shareCardText({ state, demo, verified, empty })` in `lib/copy.ts` decides
   the card's label, body and note; the card renders it. "Demo data" only for a `source='demo'` user; `failed` reads
   "Import did not finish" with the profile's incomplete line; `importing` reads "Importing record" with no stats;
   "✓ Broker connected" only for `connected` with no closes; a real trader with nothing consented gets no label.
   Unit tests of the text per state.
3. Checks: `npx tsc --noEmit`, `npm test` x4, `npm run build`, `npm run test:e2e` with the vendor fake,
   `node scripts/compliance.ts diff origin/main`, `node scripts/autopilot.ts guard main`.

## Defects, causes, fixes

| # | Defect (tester re-run 2) | Cause | Fix |
|---|---|---|---|
| 1 Medium | A second link consented while a 3-account import ran: the newer row reached `connected`, and signed out the partial record showed as Verified and whole (stats, chart, "Connected: …", no banner); the card the same | `publicRecord` took the newest consented row's state; `POST /api/import/step` drove `latestConnection` (the newest row of any state), so the older import was only finished by the tick | `aggregateRecord` / `recordStatus` in `lib/connections.ts` over every consented connection (rules in the plan above). `publicRecord` and the new `publicRecordDetail` (profile: state, simulated count, summed banner count) are built on it. While `importing` the profile lists the trades so far under the banner but shows no Verified or "New record" badge, no headline stats, evidence block or chart, no "Record since · Connected" line and no share prompts; the unfurl description is the banner line instead of stats (and starts with the incomplete line when `failed`); the feed leaves out traders with a consented connection still importing |
| 2 Low | With a newer pending link the owner's poll answered `pending`, never advanced the import and never saw it finish | same: the poll keyed on the newest row | `ownerPoll(userId)` (the route is now a thin wrapper): clocks, one step for **each** importing connection of the user, then the aggregate `{ state, imported (summed), closes }`. A trader with only a pending link gets `none`, never `pending`. The tick already drove every importing row; unchanged |
| 3 Low | Card: `failed` showed "✓ Broker connected"; a real trader with nothing consented was labelled "Demo data" | fix round 2's `state !== 'none'`; the label fell back to "Demo data" for anything not verified | `shareCardText({ state, demo, verified, empty })` in `lib/copy.ts` (strings in `SHARE_CARD`, part of `allCopy()` so the banned-claims, marks and promo checks cover them). Demo label only when `isDemoUser` (any `source='demo'` activity); `importing` → "Importing record", body "Import in progress", note "Stats appear when the import finishes." (no stats); `failed` → "Import did not finish" with the profile's incomplete line as the note (stats only if trades exist); `connected` → "✓ Verified from broker" with closes, "✓ Broker connected" with none; anything else → no label |

Design note on "failed": a failed consented import keeps the record `failed` while nothing imports, as the tester asked,
with one addition so "Try again" can ever clear it: a failed row stops counting once a **later** importing or
connected consented connection covers every one of its real accounts (a retry re-links the same accounts as a new
connection, because `completeLink` treats a failed row's authorization as fresh). A different account connected later
does not clear it; a pending link never does. This is in the unit matrix.

`latestConnection` is no longer used by product code (one existing test still calls it); left in place.

## Tests added

- `lib/connections.test.ts` (unit) "record aggregate (fix round 3)": the state matrix: nothing consented (none; the
  pre-F-1 claim → connected); pending / declined / expired never count; one row of each consented state; the tester's
  repro shape (older importing + newer connected → importing, counts summed, only the running id driven); older
  importing + newer pending / declined / expired → importing; two running → both driven; importing > failed >
  connected; supersede rules (same accounts later → cleared; partial, older, failed again, or pending → not cleared).
- `lib/connections.test.ts` (DB) "the tester's repro": 3-account import, one poll reads account 1; a second link waits
  on consent → the poll answers `importing` (never `pending`) and reads account 2; the second link is consented and
  driven to `connected` on its own → 5 rows in `closed_trades` but `publicRecord` = `importing` and `recordStatus`
  lists only the first import; the tick finishes it → 7 closes, `connected`, and the poll answers
  `{ connected, imported 14, closes 7 }`. Before the fix `publicRecord` returned `connected` at that point (the
  newest consented row), and the poll drove only the newest row.
- `lib/connections.test.ts` (DB) "newer link still pending": only a pending link → poll `none`; after consent and a newer
  pending link, polls run the import to `connected` (2 closes) and never report `pending`; the newer link stays pending.
- `lib/copy.test.ts` "share card text per state": every state × empty / with trades, demo and real; "Broker connected"
  and "Demo data" appear for no other state.
- `e2e/connect.spec.ts` "fix round 3": in the browser against the vendor fake, a 3-account import, a second link
  consented, the first import held (far-future `retryAt`) while the polls finish the second → the poll still answers
  `importing`; signed out at 375 px: the banner, no Verified badge, no `section.stats`, no "win rate", no "Connected:",
  the importing body line. The hold is released, the polls drive the first import → `{ connected, closes: 7 }`; signed
  out: no banner, Verified badge, stats, 7 closed trades.
- No test weakened or deleted. Unit 392 → 396 (1 aggregate unit test, 2 DB tests, 1 copy test); e2e 66 → 67.
- Not covered by an automated test: the feed exclusion (needs a trader with 5+ closes mid-import) and the card's
  rendered pixels (the text is unit-tested; the image route builds and renders through the existing app.spec checks).

## Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean (the first `npm run build` caught a type error in the new e2e test's cleanup query, which `tsc` does not check; fixed with `= any(...)`) |
| `npm test` (`DATABASE_URL` local Postgres 16), four runs | 396 pass every run, 0 fail, 0 skipped |
| `npm run build` | built cleanly (no framework advisory prompt appeared this time; nothing upgraded) |
| `SEED=1 node --env-file=.env scripts/db-setup.ts`, then `npm run test:e2e` (`ALLOW_DEV_AUTH=1`, vendor fake 4102 with `SNAPTRADE_BASE_URL`/`_CLIENT_ID`/`_CONSUMER_KEY`, PR-1 issuer and sink variables) | 67 passed, 0 skipped |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line |
| `node scripts/autopilot.ts guard main` | `guard: ok` |

## Compliance

- TR-3 (full history) and the meaning of Verified (TR-2): a record with any consented import still running is never
  presented as whole on the profile, the card, the unfurl text or the feed; a failed import is labelled as incomplete
  on the profile and now on the card.
- §3 consent at collection: unchanged; pending, declined and expired rows still contribute nothing public.
- No new dependency, no schema change, no drop / truncate / delete. Percent-only; no quantities or prices added.
- No third-party names added; the card strings pass the marks, promo and banned-claims checks (`allCopy()`).
- Disclaimer stays on the card.

## Files changed

`lib/connections.ts`, `app/api/import/step/route.ts`, `app/u/[handle]/page.tsx`, `app/u/[handle]/opengraph-image.tsx`,
`app/page.tsx`, `lib/copy.ts`; tests `lib/connections.test.ts`, `lib/copy.test.ts`, `e2e/connect.spec.ts`.
