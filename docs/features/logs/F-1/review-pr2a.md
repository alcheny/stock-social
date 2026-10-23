approve: false

# F-1 PR-2a · Reviewer

Date: 2026-10-23, at `325c1b4` against `origin/main`. No code changed.

## Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (Postgres 16) | 415 pass, 0 fail, 0 skipped |
| `node scripts/compliance.ts diff origin/main` | one hit, `@img/sharp-wasm32` license in installed `node_modules`. It was already there: `package.json` and the lockfile are unchanged |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| e2e `connect.spec.ts` + `app.spec.ts` (fakes started by the specs) | 58 passed. `npm run build` stops on the framework's own security advisory (`SecurityFatalError`), which is already on main and needs an owner dependency bump. The run used the build from 02:13 |
| Test names, main vs branch | none removed. The edited assertions follow committee-approved copy or the new landing. The global-count tests became per-call marker or cookie checks, which are equal or stronger: accepted |

What holds: one vendor file only. `lib/broker.ts` keeps `connectionType: 'read'` and the encryption unchanged; `basePath` is guarded by `lib/vendor-env.ts`. All SQL is parameterized; no user-controlled HTML. The schema is idempotent, and its `update` statements are guarded and never delete. Every vendor call and route is one the plan names. Verified-only, losses listed, percent-only, 18+, the TR-5 freeze (tested in `lib/sync.ts`) and no per-trade hiding all hold. The acceptance criteria PR-2a owns all map to passing tests: states and clocks, decline/expiry cleanup, sign-in by connection, refusal, the advisory lock, failure atomicity, the tick, paper accounts, the no-ghost-user case and deletion.

## Findings

1. **High · `lib/broker.ts:77-80`: open-position returns are wrong against the real vendor.** The vendor SDK documents an account position's `cost_basis` as the *per-share* book or average purchase price. The code treats it as the lot total: `(price * units - cost) / cost`. Take 10 units bought at 10 and now at 11: the code gives +1000% instead of +10%. These percentages are public on every profile (TR-4). Rule: POLICY F3c (numbers must be correct) and F4. The tests carry the same wrong assumption, so they cannot catch it: `lib/broker.test.ts:10-11,36,53` and `e2e/fakes/vendor.ts:114` both use a total cost basis. Fix: `(price - cost_basis) / cost_basis`; fake and tests per-share.

2. **Medium · `app/u/[handle]/trade/[sellId]/page.tsx:26,57-59` and `app/u/[handle]/month/[ym]/page.tsx:27,75-77`: whole-record stats show while an import runs.** When a second consented import is running, the profile hides the stats and the trade and month images set `stats: false`. These two pages and their link-preview descriptions still show "Their whole record" with win rate and average return, and give no importing line. Rule: TR-3 / POLICY F3a (nothing partial presented as complete). The PR's own fix rounds apply this rule to the profile, feed and images, so these pages fall inside its scope.

3. **Medium · `lib/sync.ts:27` (rebuild over all activities) and `lib/connections.test.ts:560`: a real account the vendor later flags as simulated stays in the record.** Its earlier trades stay in `closed_trades` with Verified, while the profile also counts it as "simulated account excluded". The test asserts this outcome ("the record stays"). Plan §4 and §9 say simulated accounts never enter the record or carry Verified and stay excluded when flagged on a later sync. Rule: plan §9 and POLICY F3a. Drop them from the rebuild, or log the choice as an owner open question.

4. **Low · `app/u/[handle]/opengraph-image.tsx:14`: the profile card's `alt` still reads "Verified trading record".** That is wrong for demo, failed and importing profiles. The trade and month alts were neutralized in round 6. Rule: POLICY F3a, A1.

5. **Low · `app/u/[handle]/page.tsx:206`: positions are keyed and listed by symbol only.** The same symbol held in two accounts gives a duplicate React key and two identical rows, since `open_positions` is per account. Group by symbol or key by account and symbol.

6. **Low (style) · `app/auth/callback/[provider]/route.ts:34` and `app/auth/email/route.ts:18`: the statement's `;` ended up inside the trailing comment** (`303) // ... (committee item 7);`). An edit artifact.

7. **Low (style) · `lib/broker.ts:117`: `listAccountIds` has no caller left.** Dead code in a protected file beyond F-1's need.

## Notes (not blocking)

- PR-2b carries: the "broker" placeholder in "Connected: broker", the zero-trade preview copy, and the lured-portal case.
- Owner: the framework advisory blocks `npm run build` on this branch and on main.

## Re-check

approve: false

Date: 2026-10-23, at `3ad9377` against `origin/main`. No code changed.

### Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` (`DATABASE_URL=postgres://…@localhost:5432/stock_social`) | 419 pass, 0 fail, 0 skipped (415 → 419) |
| `node scripts/compliance.ts diff origin/main` | only the pre-existing `node_modules/@img/sharp-wasm32` license line; `package.json` and the lockfile unchanged |
| `node scripts/autopilot.ts guard main` | `guard: ok` |
| `CI=1 npm run build < /dev/null` | compiles and generates all 22 routes (fresh `.next/BUILD_ID`, the new `unrealizedPct` is in the server bundle), then exits 1 on the framework's own advisory check, as on main (owner dependency bump) |
| `npx playwright test` with `SNAPTRADE_BASE_URL=http://127.0.0.1:4102 SNAPTRADE_CLIENT_ID=e2e SNAPTRADE_CONSUMER_KEY=e2e`, `CI=1` (fakes started by the specs) | 70 passed, 0 failed, 3 skipped. The skips are the two OIDC provider tests and the email-send-failure test in `signin.spec.ts` (their fakes' variables unset); every `connect.spec.ts` test ran |
| Removed lines in `3872e3e..3ad9377` | one test name changed (`unrealizedPct`, its old name stated the wrong formula) and one assertion changed (the paper test, below). No test deleted or skipped |

### Finding 1 (High): resolved

The SDK's own models (`node_modules/snaptrade-typescript-sdk/dist/index.d.ts`). The positions call returns
`AllAccountPositionsResponse` (line 3545), whose `'results': Array<AccountPosition>` (line 3552) are:

- line 3210: `units`: "The number of units held in the position. Positive numbers indicate long positions and negative numbers indicate short positions."
- line 3216: `price`: "Last known market price _per share_. …"
- line 3222: `cost_basis`: "Book price or average purchase price for the position. For options, this is per-share."
- the older `Position` model, line 823: `average_purchase_price`: "Cost basis _per share_ of this position."
- for contrast, `TaxLot`, line 765: `cost_basis`: "The cost basis of the entire lot." Only the tax lot carries a lot total.

All three `AccountPosition` fields are typed `string | null`; `unrealizedPct` converts each with `Number()`.
`lib/broker.ts:83-88` now computes `(price - cost) / cost` with `cost` = `average_purchase_price` when positive, else
`cost_basis`; `null` unless units, price and cost are all positive. Hand check of `lib/broker.test.ts:10-11`: 10 units
bought at 10, now 11 → (11 − 10) / 10 = 0.1 (+10%; the old formula gave (110 − 10) / 10 = 10, +1000%); 2 at 50 now
45 → (45 − 50) / 50 = −0.1. Both match. The HTTP test (`lib/broker.test.ts:47`, 10 at 10 now 11 → 0.1), the fake (`e2e/fakes/vendor.ts:12,114`,
strings per unit like the SDK) and the e2e position (10 units at 100, now 110 → `QQQ+10.0%`, `e2e/connect.spec.ts:122,164`)
are all per unit. A total-cost reading would fail every one of them.

### Findings 2 to 7: resolved

2. `lib/copy.ts#wholeRecordView`/`wholeRecordPreview`: importing → no win rate, avg return, evidence or New record
   on the trade and month pages, and descriptions "N closed trades so far · Import in progress…"; failed → the incomplete
   line plus the stats; demo always stats. `imageTrust` takes `stats` from the same function, so pages and images
   cannot drift. Unit test covers every state; e2e two-import test checks both pages and their descriptions signed out,
   and the trade page's stats after the import finishes.
3. `lib/sync.ts:31-32`: the rebuild leaves out activities of the user's accounts flagged `is_paper`; raw rows stay.
   The changed paper-test assertion (`lib/connections.test.ts:560`, 1 → 0 closed trades) is a correction, not a
   weakening: plan §4 ("stays excluded when flagged on a later sync") and §9 ("They never enter the record or carry
   'Verified' … flag re-read on every sync") require 0, and the old assertion encoded the behavior this review flagged.
   The same test now also asserts the raw activities kept and the excluded count 2, and a new DB test covers the
   reflag on the hourly sync (only the other account's trades and position remain, count 1) and the flag cleared.
4. `app/u/[handle]/opengraph-image.tsx` drops the static alt; `app/u/[handle]/page.tsx` `generateMetadata` declares the
   same image URL with `profileCardAlt`, built from the card's own label. Unit test per state; e2e asserts the demo,
   importing and failed alts (exactly one `og:image:alt` each) and the unchanged image path.
5. `lib/positions.ts#positionRows`: one row per account and symbol, distinct keys, a muted "account N" label only when a
   symbol is held in more than one account, no vendor account id rendered. Not merging is the right call: a weighted
   percent needs amounts the record never stores. Tested.
6. Both redirects now end `303); // …`.
7. `listAccountIds` removed; no caller remains (checked outside `node_modules`).

### Remaining findings

1. **Low · `lib/sync.ts:31-43` with `lib/connections.test.ts:571,604-607`: a thesis on a reflagged account's trade is
   deleted for good, and the new test's "returns if the vendor clears the flag" does not check it.** On the flagged
   rebuild those trades are no longer produced, so `reattachTheses` orphans their theses (published or `held`) and the
   `delete from closed_trades` removes them, with only a server warning. When the flag clears, the trades come back
   with no thesis. This fix round created that path: before it, a reflag never removed trades, so their theses were
   never orphaned. The log says the trades "come back", which leaves this out. Rule: CLAUDE.md Architecture ("Theses
   survive rebuilds … re-attached by `sell_id`") and the Product rule that `held` theses are never silently dropped.
   Fix: keep the theses of excluded-account trades across the rebuild (for example, keep those `closed_trades` rows'
   thesis fields aside by `sell_id` and re-attach them when the trades return), with an assertion in the reflag test
   that a thesis written before the reflag is back after the flag clears. If the owner accepts the loss, the other
   option is a `ponytail:` note next to the existing orphan note, an assertion that records the loss, and an owner
   open question. Either way the test must state the outcome.

### Notes (not blocking)

- `docs/features/logs/F-1/build-pr2a-fix4.md:310` says "No test removed or renamed". One test was renamed
  (`lib/broker.test.ts:9`). The rename is justified because the old name stated the wrong formula, but the log should
  say so.
- Carried from the first review: the PR-2b items, and the framework advisory that blocks `npm run build` on this branch
  and on main (owner).
