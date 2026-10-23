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
