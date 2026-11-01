# Known limits: committee record (2026-11-01)

Session: `claude/known-limits`, started by the owner's orchestrating session under the owner's instruction of
2026-11-01 to resolve every `ponytail:` known limit. Open questions are decided by the committee's recommended option
(owner's instruction). Other sessions own `app/t/**`, `app/api/sync/**`, `lib/sync.ts` (sharded sync),
`lib/rate-limit.ts` and the options part of `lib/broker.ts`; `lib/broker.ts` is protected (CODEOWNERS).

## Scope

| # | Known limit | Where |
|---|---|---|
| 1 | Symbols past the 5,000 cap fall off the sitemap alphabetically | `app/sitemap.ts` |
| 2 | Vendor account ids are per connection: a fresh connection can dodge the TR-6 account claim | `lib/claims.ts` |
| 3 | A feed page with no kept list (a crafted `?after=`) is linear in the sells imported since its asOf | `lib/feed.ts` |
| 4 | Users who already share an account (the pre-TR-6 exploit) keep their rows | `db/schema.sql` |
| 5 | "Open positions (TR-4) are deferred" note on TR-9 is stale since F-6 | `lib/trades.ts` |

## Engineer's plan (round 1)

### 1. Sitemap index above 5,000 symbols
- Next.js 16.4 (`node_modules/next/dist/docs/…/generate-sitemaps.md`): `generateSitemaps()` serves `/<path>/sitemap/<id>.xml`;
  the `id` reaches the sitemap function as `Promise<string>`. Next does not write a sitemap index file itself.
- `/sitemap.xml` stays a urlset (e2e checks it): home, `/t` and the first 5,000 indexable symbols, as today.
- New `app/sitemaps/sitemap.ts` with `generateSitemaps()`: chunk k ≥ 1 holds indexable symbols (k·5,000, (k+1)·5,000]
  in the same alphabetical order. Unknown ids 404 (Next checks the id against `generateSitemaps()`).
- New `app/sitemap-index.xml/route.ts`: a `<sitemapindex>` listing `/sitemap.xml` and every chunk; `robots.txt`
  points at it.
- Indexability moves into SQL (`having` with MIN_INDEX_TRADES / MIN_INDEX_TRADERS), so thin or demo-only symbols no
  longer use up the cap's slots (today `limit 5000` is applied before the indexable filter).
- Pure helpers and the DB reads in a new `lib/sitemaps.ts` (keeps `lib/ticker.ts`, used by `app/t/**`, untouched).
- Tests: pure chunk math and index XML (escaping); DB test with 12,001 indexable symbols under a test prefix: every
  one appears in exactly one sitemap, in order, none dropped.

### 2. A stable account identity behind the claim
- The vendor SDK's `Account.institution_account_id` (node_modules/snaptrade-typescript-sdk/dist/index.d.ts): "A stable
  and unique account identifier provided by the institution … When present, can be used to check if a user has
  connected the same brokerage account across multiple connections." Optional and nullable.
- Additive table `broker_account_identities (identity text primary key, user_id, claimed_at)`. `identity` is an
  HMAC-SHA256 (key derived from `APP_SECRET_KEY`) of the normalized institution name and the institution account id:
  the raw identifier, which can be an account number, is never stored (GLBA minimization).
- `claimIn` claims the identity in the same transaction with the same insert-then-check (race-safe); a conflict on
  either the vendor id or the identity refuses the whole link. `completeLink` refuses early on an identity owned by
  another profile; the connection snapshot carries the identity hash (never the raw id) so consent can claim it.
- Blocker: `lib/broker.ts#listAccounts` does not pass `institution_account_id` through, and `lib/broker.ts` is
  protected. The claim code reads `institutionAccountId` when present; the one-line `lib/broker.ts` change is handed to
  the owner in the PR body. Until it lands, the dodge stays open: a precise `ponytail:` note says so.
- Tests: the dodge (user A claims account X via vendor id v1 with identity I; user B links v2 with identity I → refused,
  nothing claimed); same user reconnecting (v1 → v2, same identity) is allowed; no identity → today's behavior;
  the hash never equals or contains the raw id.

### 3. Bounded work for a page with no kept list
- Root cause: the "imported after asOf" filter reads every sell imported since asOf into an array. A stored import time
  per close removes that read: additive `closed_trades.sell_imported_at` (the closing sell activity's `created_at`).
- Set by a `before insert` trigger on `closed_trades` (one unique-index probe per row; round 1 proposed `plan_cache_mode =
  force_custom_plan`, dropped after the reliability review: the probe uses only the unique index, so no plan can pick
  another), so `lib/sync.ts#rebuildTrades`
  (owned by another session) needs no change; backfilled once when the column is added.
- `lib/feed.ts`: the late filter becomes `sell_imported_at is null or sell_imported_at <= asOf` on the close itself, in
  one new helper. The work is then bounded by the closes the statement reads anyway; no read depends on how many sells
  were imported since asOf. Same rows filtered as before, so the order for honest cursors is unchanged (asserted by the
  existing load tests, which compare to the kept list's page).
- Load test (LOAD=1): page 2 with no kept list after 600,000 late sells, before/after numbers recorded here.

### 4. Accounts already shared by two profiles
- Additive table `shared_account_marks (account_id, user_id, owner_user_id, marked_at)`: a profile holding activities
  of an account that `broker_accounts` assigns to another profile (the earliest activity's user, from the TR-6
  backfill). Nothing is deleted: raw activities stay.
- The earliest claim is authoritative for display: the rebuild leaves a marked (account, profile) out, exactly like a
  simulated account (two-line change in `lib/sync.ts#rebuildTrades`, a shared SQL fragment from a new module); theses
  move to `kept_theses` as for simulated accounts.
- `scripts/shared-accounts.ts`: marks (idempotent) and prints counts only (accounts, profiles); `--rebuild` rebuilds
  the marked profiles' derived records. No ids, handles or account ids in its output.
- Tests: marking finds only true duplicates, is idempotent, ignores demo and same-user rows; a marked profile's rebuild
  excludes the account and keeps the thesis; the owner's record is unchanged; output has no ids.

### 5. TR-9 and open positions
- F-6 decision (2026-11-01, `docs/features/F-6-open-positions.md`): the range stays closed trades only and says so;
  including open positions is its own feature (needs `open_positions.opened_at`, moves feed ranking). D-48 tracks it.
  Not a small, safe change: the note is rewritten to say exactly that; no behavior change.

## Reviews (round 1, fresh-context subagents)

**Business lead:** approve with demands. Item 1 approve (moving the indexable rule into SQL also fixes thin symbols using
up the cap). Item 2 approve, but the PR must not claim the dodge is closed while `lib/broker.ts` does not pass the field;
HKDF key under its own label; the hash never in logs or URLs. Item 3 approve; prove the same rows are filtered (an
equivalence test: a late sell dated before asOf, a close with no activity, a list with and without a kept list). Item 4
approve marking only; silently changing a public record is the owner's call, so the script reports by default and marks
or rebuilds only when asked. Item 5 approve as written.

**Reliability reviewer:** blocking: (a) the `o` array behind the weight fingerprint is linear in late sells too: replace
it, with an index for the per-trader count; replace all four late filters (`c`, the five-count, `weights()`, `ol`);
(b) the trigger must probe only the unique `(source, external_id)` index (a `user_id` predicate lets the planner pick a
user index range on a fresh import's unanalyzed rows, per close); (c) no full backfill inside the schema transaction (it
holds ACCESS EXCLUSIVE): backfill only sells imported in the last 49 hours (cursors live 48), only in the branch that
adds the column; guard the trigger with `pg_trigger` like `display_log`; (d) identity claims in a separate table were
never released with a provisional claim. Should-fix: `--rebuild` takes the trader's lock; exclusion in both rebuild
queries and open positions too; `lib/sync.ts` is another session's file; the detection premise (vendor ids are per
connection, activity ids unique per source: count before building); sitemap chunk requests re-run the count, a database
blip must not turn into a 404; sort claim inserts (deadlock); a signed-out owner reconnecting under a new vendor id
should sign in, not be refused.

## Decisions (committee's recommended options)

- 2026-11-01 · Item 1: robots.txt lists every sitemap (Next's robots takes a list); no hand-written index route. Why:
  business lead Q4, less code, nothing in the repo needs a single index URL. `/sitemap.xml` stays a urlset (e2e).
- 2026-11-01 · Item 1: further sitemaps fail with a 5xx on a database error at run time and list none only while
  building (`NEXT_PHASE`); the count is kept 10 minutes per server. Why: reliability review (a false 404 drops pages).
- 2026-11-01 · Item 2: the identity is an HMAC-SHA256 of the normalized institution name and `institution_account_id`,
  key from HKDF(APP_SECRET_KEY, label `stock-social/broker-account-identity/v1`). Why: business lead Q1 (the identifier
  is unique within an institution; a false refusal is worse than a missed dodge), GLBA minimization.
- 2026-11-01 · Item 2: the identity is a column on the claim row (`broker_accounts.identity`), checked under a
  per-identity advisory lock, not a separate table. Why: reliability blocker (d): it is released exactly with its claim.
- 2026-11-01 · Item 2: a brokerage-first link whose every real account is one profile's (by confirmed vendor id or
  confirmed identity) signs in to that profile; any other owned identity refuses the link. Why: reliability note 11.
- 2026-11-01 · Item 2: `lib/broker.ts` is not edited (protected; the options session owns its activity part). The
  one-line change goes to the owner in the PR body; the `ponytail:` note stays, rewritten, until it lands. Why: rules.
- 2026-11-01 · Item 3: a stored import time per close (`closed_trades.sell_imported_at`), set by a guarded BEFORE INSERT
  trigger probing only the unique index, backfilled for the last 49 hours once; all four late filters read it; index
  `(user_id, sell_imported_at)` for the fingerprint count. Why: reliability blockers (a)–(c); no edit to `lib/sync.ts`.
- 2026-11-01 · Item 4: `scripts/shared-accounts.ts` reports counts by default, `--mark` marks, `--rebuild` rebuilds the
  marked profiles under the trader's lock and drops the marked account's open positions; the schema apply never marks.
  The rebuild filter is a 2-line edit in `lib/sync.ts#rebuildTrades` (a shared fragment from `lib/shared-accounts.ts`),
  noted for the sharded-sync session. Why: business lead (owner's call), reliability should-fix.
- 2026-11-01 · Item 4: no UI notice for a marked profile in this PR. Why: business lead Q2: a UI addition is a product
  change (three variants); run the count first; if it is above 0, the owner decides before `--rebuild`. The report's
  limit (only same-vendor-id duplicates are detectable) is documented in `lib/shared-accounts.ts`.
- 2026-11-01 · Item 5: no behavior change; the note now says what F-6 decided and what including open positions needs.

## Load test (item 3), `LOAD=1 node --test lib/feed.crafted.load.test.ts`

Crafted cursor 47 hours old, page 2, 500 traders (12 heavy), medians of 7 reads:

| | no late sells | after 600,093 sells imported since asOf |
|---|---|---|
| before (array of late sells) | weights kept 72 ms, cold 208 ms | weights kept 641 ms (+568), cold 968 ms (+760): fails |
| after (`sell_imported_at`) | weights kept 53 ms, cold 140 ms | weights kept 64 ms (+11), cold 141 ms (+1): passes |

The existing `lib/feed.load.test.ts` suite (6 cases, including 150,000 late activities and 150,000 listed traders' late
closes, stale and analyzed statistics) passes unchanged on the new filter.

## Tester QA and independent code review (round 1)

Both ran on fresh context against the committed diff; 19 new tests pass; no blocking defect in items 1, 3, 4, 5.

| Finding | By | Decision |
|---|---|---|
| H1: once identities arrive, a past dodge resolves by sync order: the dodger syncing first locks the earliest claimant out | tester, reviewer | Fixed: an identity clash goes to the older claim (a new claim is always the later one); test for both sync orders |
| M1: signing in by identity alone lets anyone who can sign in to the brokerage account (a joint holder) into the profile | tester | Reverted to refusing: an auth decision for the owner (open question below) |
| L1: paper accounts carry identities; shared sandbox ids would refuse real links | tester | Fixed: no identity on paper accounts; tested |
| L2: a signed-out owner with an unfinished link is told "claimed" | tester | Moot after M1 (every identity-only brokerage-first link is refused); copy unchanged |
| L3: a SELL with the same vendor id from the other source, imported after the close, no longer makes it late | tester | Not reachable (demo ids carry their own prefix); `ponytail:` note in lib/feed.ts |
| L4 / review 4: stale `/sitemap-index.xml` comment | both | Fixed |
| L5: `/sitemap.xml` answers with home and /t on a database error | tester | Kept (today's behavior; the first sitemap must always answer); noted in app/sitemap.ts |
| L6: the TR-9 note lost its `ponytail:` marker though D-48 stays open | tester | Fixed: marked again |
| Review 2: identity locks sorted by text but keyed by hash | reviewer | Fixed: one statement locks the distinct hashes in order |
| Review 3: the identity hash in `connections.accounts` is not in the retention map | reviewer | Fixed: SCHEMA_MAP text |
| Review 5: two sitemap tests only match source text | reviewer | Kept as structure checks; behavior is covered by the DB test and the e2e sitemap test |
| Review 6: the per-server count cache can list a sitemap another server 404s for up to 10 minutes | reviewer | `ponytail:` note in lib/sitemaps.ts |

## Added by the orchestrator (2026-11-01)

- **ponytail sweep.** Every limit left gets `ponytail: <what is limited> — <what would fix it>` at its place; the sweep
  (read-only subagent) found 20 unmarked limits outside other sessions' files; 19 are marked (list in the PR body). Not
  edited: `scripts/handoff.ts:248` (the loop's publish step; its 50-finding cut is reported in the PR body instead).
- **Privacy purge (lib/privacy-purge.ts).** Reproduced: 220,000 due orphans with stale statistics, one orphan batch ran
  past 10 minutes (cancelled; the plan scanned closed_trades per orphan row, its estimate 162 rows). Fix: each orphan
  batch in its own transaction with `set local enable_seqscan = off` (every check is an index probe), and `analyze
  privacy_orphans` after a mark of a batch or more. `LOAD=1 node --test lib/privacy-purge.load.test.ts`: 220,000 rows in
  5.5 s over 49 batches, slowest batch 1.05 s (box 20 s). The clearing step's walk over every orphan stays a `ponytail:`.
- **Flaky e2e (e2e/section.spec.ts:90).** Root cause: specs that create feed-eligible traders (5+ closes) without the
  feed lock: `share-card.spec.ts` (heavy fixtures that rank high in the section pool), `app.spec.ts#makeTrader` and the
  dividend_dan trend test. The section test holds the lock exclusively; those now hold it shared while their data exists
  (`makeTrader(…, held = true)` for callers that already hold it exclusively). The assertion is unchanged.

## Open questions for the owner

- Should an owner who links the same brokerage account again while signed out (new vendor id, same institution
  identity) be signed in to their profile? It would also admit anyone else who can sign in to that brokerage account.
  Today: refused.
- The one-line `lib/broker.ts` change that turns the identity check on (PR body). Before it lands, run
  `scripts/shared-accounts.ts` (counts) against production; past dodges then resolve to the older claim on their syncs.
- **Test hygiene (orchestrator).** `lib/record-tools.test.ts` (feed-eligible users, 12 closes each) and
  `lib/billing.test.ts` left every user they made: on a database shared with e2e they leaked into the feed (e2e "the
  demo-only feed renders no section"). Both now delete exactly the users and sign-up attempts they made, in `after()`.
  A count by handle prefix after a full `npm test` found no other leaking file on main (corporate actions and
  f2-personal tests are not on main yet: PRs #40 and #30).
