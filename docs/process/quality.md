# Quality gates

What a lane-C change must pass before it is pushed, reviewed and merged, and the standards behind each check. Commands
themselves are in [CLAUDE.md → Commands](../../CLAUDE.md); legal and security rules are in
[docs/POLICY.md](../POLICY.md). Where a work item stands in its lifecycle: [lifecycle.md](lifecycle.md).

## Local environment

Start from CLAUDE.md → Commands. Deltas for cloud and desktop sessions:
- **Postgres.** `npm run db:up` needs docker. Without it, point `DATABASE_URL` at any Postgres (CLAUDE.md) and apply the
  schema with `node --env-file=.env scripts/db-setup.ts` (no `psql` needed; `SEED=1` also seeds).
- **`.env`.** `cp .env.example .env`, then set `APP_SECRET_KEY` and `CRON_SECRET` to random strings (CLAUDE.md). For the
  connection-flow e2e tests set the vendor-fake values CI uses: `SNAPTRADE_BASE_URL=http://127.0.0.1:4102`,
  `SNAPTRADE_CLIENT_ID=e2e`, `SNAPTRADE_CONSUMER_KEY=e2e` (`.github/workflows/ci.yml`, both jobs; test values only).
  Without them those tests skip themselves.
- **Browser.** `npx playwright install --with-deps chromium` (the step CI runs).
- **Font.** DejaVu Sans must be installed. Check the pin with an absolute path:
  `FONTCONFIG_FILE="$PWD/e2e/fonts.conf" fc-match system-ui` must print `DejaVu Sans` (checked in a cloud session,
  2026-11-01; a relative path fails to load the file and falls back to the system font). macOS lacks the font by
  default. Why: [Rendering determinism](#rendering-determinism).
- **e2e.** `npm run test:e2e` needs a prior `npm run build` and a seeded database (CLAUDE.md); the config starts
  `npm run start` with `ALLOW_DEV_AUTH=1` (`playwright.config.ts` `webServer`).

## Before every push

In this order, on the branch after merging current `origin/main` (orchestrator report, 2026-11-01):
1. `npx tsc --noEmit`: clean.
2. `npm test` **twice**: 0 failures both times, and the test count is not lower than main's (CLAUDE.md; CI's guard
   fails a drop). Two runs catch order- and data-dependent failures on the shared database
   ([collaboration.md → Shared test database](collaboration.md#shared-test-database)).
3. `BASE_REF=main node scripts/compliance.ts auto`: `compliance: ok (tree)`. Scan modes: POLICY "How it is enforced".
4. `node scripts/autopilot.ts guard main`: no findings (`guardFindings`: test count drop, destructive schema line).
5. `npm run build`.
6. Full e2e (`npm run test:e2e`) after merging main, not only the specs you touched.
7. **Conditional:** when the PR touches `lib/sync.ts`, `lib/connections.ts`, `lib/trades.ts` or `lib/broker.ts`,
   attach the `# load:` lines of `LOAD=1 node --expose-gc --test lib/sync.load.test.ts` to the item's log. The rule
   is docs/IMPLEMENTATION.md's interim rule under The cycle (until request #13 is answered); not restated here.

CI steps that the list above does not reproduce, and when they matter:
- **actionlint** (`static`, step "Lint workflows"): only when a PR changes `.github/workflows/`, which lane C does not
  do without the owner.
- **Missing `DATABASE_URL` check** (`static`): only when a PR changes `scripts/db-setup.ts`.
- **`VERCEL_ENV=preview npm run vercel-build`** (each `e2e` shard: schema + seed + `next build` on a fresh database):
  when a PR changes `db/schema.sql`, `scripts/seed.ts` or `scripts/db-setup.ts`. Run it locally against an empty
  database first.

## CI layout

`.github/workflows/ci.yml` runs on every `pull_request`, every push to `main` and on dispatch. No path filter, so
docs-only PRs run the full suite.

| Job | What it runs | Notes |
|---|---|---|
| `static` | `npm ci`, `tsc`, policy scan (`compliance.ts auto` against the PR base), actionlint, `npm test`, guardrails (`autopilot.ts guard <base sha>`, skipped on main), the db-setup missing-URL check | Own Postgres 17 service |
| `e2e` ×4 | Picks its slice (`scripts/e2e-shard.ts pick`, then `verify` that the `--test-list` matched exactly that slice), builds as a Vercel preview, installs Chromium, runs `playwright test --workers=1` | `fail-fast: false`, each shard has its own database, server and vendor fake |
| `check` | Passes only if `static` and `e2e` both succeeded | The Gate, the doctor and the feature pipeline read this exact job name. Lane-C merges require it green on the head ([lifecycle.md → Merge](lifecycle.md#12-merge)) |
| `notify-gate` | Dispatches Review or the Gate | Only for dispatched runs (lanes A and B); never on lane-C PRs |

Sharding: `scripts/e2e-shard.ts` cuts the ordered test list into contiguous slices of about equal *estimated* time
(`WEIGHTS`, seconds per test per spec file measured on CI on 2026-11-01; `DEFAULT_WEIGHT` 4 for a new file). Each test
runs exactly once by construction. A spec file may be split across shards, so its `beforeAll`/`afterAll` may run more
than once and a test must not depend on an earlier test in its file.

`.github/workflows/gate.yml` also runs after every CI completion on a lane-C PR. It finds no autopilot or lane-B
feature PR and logs "not an open autopilot or feature PR" (`scripts/autopilot.ts` gate: a lane-B feature PR needs a
`feature/` head and the bot as author). It merges nothing in lane C.

**Duration, measured:** 84 successful `ci.yml` runs created on 2026-11-01 (REST `actions/workflows/ci.yml/runs?created=2026-11-01&status=success`,
then `actions/runs/<id>/timing` → `run_duration_ms`; layout from `actions/runs/<id>/jobs`; queried 09:41 UTC by
fact-checker FC2). Sharded layout (71 runs): median 222 s (3 min 42 s), range 181–421 s; first job start to last job
end (jobs API): median 213 s. Old one-job layout (10 runs): median 363.5 s, range 309–381 s. Excluded: 2 old-layout
runs whose `run_duration_ms` reads ≈ 66 min because their timestamps straddle the API's +1 h jump, and 1 run with no
timing yet. The earlier figure "about 3 minutes" (orchestrator report) is the fast end of the sharded range.

## Rendering determinism

- `e2e/fonts.conf` maps `system-ui` and `sans-serif` to DejaVu Sans; `playwright.config.ts` passes it to the browser
  as `FONTCONFIG_FILE` (resolved to an absolute path).
- Why: the same string rendered 219.8 px wide in a session container and 248.3 px in CI, 13.0 % wider (248.3 /
  219.8 = 1.130; measured by the orchestrator, 2026-11-01). Fit tests passed locally and failed in CI: 5 red runs
  (orchestrator report). Fixed in PR #41 (merged 08:50 UTC 2026-11-01, committer date).
- Rule: a fit assertion keeps **at least 15 % headroom**, not a bare fit (orchestrator report, 2026-11-01; not yet
  written elsewhere). Example: `e2e/f6-open-positions.spec.ts` asserts each value uses at most 80 % of its box.

## Test rules

- **Tests first:** a test for every acceptance criterion before the code (docs/IMPLEMENTATION.md Decisions,
  2026-10-22).
- **Never weaken, skip or delete a test** (CLAUDE.md → Autopilot: "Never weaken or delete existing tests";
  "skipped": team/reviewer.md condition 2). CI enforces two parts of it: the test count may not
  drop, and `db/schema.sql` may not gain a `drop`, `truncate` or `delete from` line (`scripts/autopilot.ts`
  `guardFindings`; SQL comments are ignored).
- **Feed lock:** an e2e test that fills or reads the shared feed holds `e2e/feed-lock.ts`: `feedLock('exclusive')` for a
  test that fills or reshapes the feed (the heavy-feed test in `app.spec.ts` and others: 17 call sites in `app`,
  `section`, `follow` and `f2-personal` specs, grep 09:47 UTC), `'shared'` for a test that only looks for its own rows.
- **Shared test database:** rules in [collaboration.md → Shared test database](collaboration.md#shared-test-database).
- **Privacy maps** (single home; lesson of 2026-11-01, orchestrator report; each map is held to the code by a unit
  test, verified by grep 09:30 UTC). A change that adds data updates its map in the same PR:

  | Change | Update | Test that fails otherwise |
  |---|---|---|
  | New table in `db/schema.sql` | `SCHEMA_MAP` in `lib/privacy-retention.ts` (personal or not, retention class) | `lib/privacy-retention.test.ts` |
  | New cookie | `COOKIE_TABLE` in `lib/privacy-cookies.ts` | `lib/privacy-cookies.test.ts` (scans every cookie write); `e2e/privacy-gate.spec.ts` |
  | New column on `closed_trades` or `open_positions` | `PUBLIC_FIELDS`, `PRIVATE_FIELDS` or `NOT_A_FIELD` in `lib/privacy-fields.ts` | `lib/privacy-fields.test.ts` |
  | New server log line | pass errors through `logSafe` (`lib/privacy-log.ts`); never log an error's message | `lib/privacy-logs.test.ts` |

## Review standards

This section is the single home of the lane-C review terms (verified finding, blocking finding, dispute, review
marker). Who reviews when: [lifecycle.md → Stages](lifecycle.md#stages), stages 7 (in-session review) and 9
(independent review).
- **Standard:** [team/reviewer.md](../../team/reviewer.md) (policy first, then its six conditions, plus the feature-PR
  rules). The orchestrator's reviewer and the in-session reviewer use it unchanged.
- **Verified finding:** a finding that cites file, line and the failure (a failing command, a rule id, or an
  acceptance criterion with what the code does instead).
- **Blocking finding:** a verified finding that breaks POLICY, an acceptance criterion, a CLAUDE.md product rule or a
  [test rule](#test-rules). Everything else is should-fix and does not block the merge.
- **Disputes:** a builder who disagrees replies on the finding; the finding goes back to the reviewer for a focused
  re-review. The builder never closes a finding alone.
- **Review marker:** a PR comment whose first line is exactly `Independent review: pass at <sha>` or
  `Independent review: fail at <sha>` (full head SHA), followed by the blocking findings. A marker covers only that
  SHA; any later push needs a re-review ([lifecycle.md → Merge](lifecycle.md#12-merge)).
- The reviewer also checks that the item's records are in the right place
  ([decisions-and-authority.md → Records](decisions-and-authority.md#records)).

## Ponytail convention

Single home of the convention. Owner, 2026-11-01: "ponytail skills should be used everywhere". There is no installed
skill of that name; it is the convention behind CLAUDE.md → Known limits ("marked `ponytail:` in code").
- Every known limit left in code gets, at the exact place, `// ponytail: <what is limited> — <what would fix it>`
  (`-- ponytail:` in SQL; example `db/schema.sql`).
- The PR body carries one `## Known limits` line per note.
- A PR that touches a file resolves its existing ponytail notes, or makes them precise.
- Docs-only work ends with a `## Known limits` section in the same form (every file in `docs/process/` does).

## Compliance

- Every PR answers [docs/COMPLIANCE.md](../COMPLIANCE.md) "1. The procedure for every change" under a `## Compliance`
  heading (CLAUDE.md → Read first).
- Scanner modes and what each POLICY rule checks deterministically: POLICY "How it is enforced". The scanner is step 3
  of [Before every push](#before-every-push).
- Wording limits for the process docs themselves (POLICY T1, T2, P1, P5): name only T1's integrated vendors; write
  "the billing vendor", never its name; no people's names; no session ids, queue contents, usage snapshots or personal
  email; never copy a non-integrated vendor name from another doc.

## Protected paths (mechanics)

Each list lives in one file; this table names the list and what it does, and lists no paths.

| List | What it does | Applies to |
|---|---|---|
| `.github/CODEOWNERS` | The Gate's `gateDecision` sends a PR touching these paths to `needs-human` | Lanes A and B. Lane C: no branch protection enforces it (docs/AUTOPILOT.md → Known limits) |
| `scripts/team.ts` `PROTECTED` | Agents' Edit/Write to these paths is refused; anything else that reaches them is put back after each call | Lanes A and B agents |
| `scripts/autopilot.ts` `LOOP_PATHS` | A line PR that changes loop files is sent back to be reverted | Lane A lines |
| `scripts/doctor.ts` `DOCTOR_FORBIDDEN` | Files the doctor may never change | The doctor |
| `scripts/handoff.ts` `verify` | Refuses a build hand-off with a protected path (except the team's own logs), a symlink, a submodule, CODEOWNERS or an agent-instruction file | Lane B publish |

Who may merge a lane-C PR that touches these paths: [decisions-and-authority.md](decisions-and-authority.md#owner-only)
(open question Q6). A `/approve` comment on a lane-C PR runs `autopilot.ts approve`, which posts an approval
marker for that head and dispatches the Gate; the Gate ignores lane-C PRs, so nothing merges.

## Diff size

The Gate's `MAX_DIFF` is 800 changed lines (docs/AUTOPILOT.md Controls); for lane-B feature PRs it counts product lines
only (owner pre-authorization 2026-10-24, docs/IMPLEMENTATION.md request 2; `productLines`). Lane C has no automated
cap; the orchestrator and the reviewer judge size.

## Red CI on 2026-11-01

- **Count (REST, fact-checker FC2, 09:47 UTC):** 32 `ci.yml` runs with `conclusion=failure` created on 2026-11-01, of
  126 runs (`actions/workflows/ci.yml/runs?created=2026-11-01&status=failure`). Layout and failed jobs per run from
  `actions/runs/<id>/jobs`: 20 ran on the old one-job layout (only `check` failed): 17 started 06:55–07:23 UTC
  (14 on the orchestrator's branch, 2 on main, 1 on a dependency branch) and 3 later ones on branches that had not yet
  merged #29 (2 privacy, 1 F-2). 12 ran on the sharded layout (3 of them on #29's own branch before it merged): an
  `e2e` shard failed in 10, `static` in 4 (2 runs had both).
- **Root causes (orchestrator report, not recounted):** font mismatch 5, shared-database race 1 (fixed in #31), one real
  layout bug, new-test fixtures for the rest. Assigning each red run to a cause needs its job log; not done here.
- Some API run timestamps that day read +1 h ([budget-and-rate.md → Measured throughput](budget-and-rate.md#measured-throughput));
  counts by date are unaffected.

## Known limits

- No branch protection: nothing technically stops a merge with red CI or no review (docs/AUTOPILOT.md → Known limits)
  — branch protection, or a required `check`, removes this.
- The lane-C review standard and the diff size are judgment calls, with no Gate — a lane-C gate script (REST only)
  removes this.
- Full CI runs on docs-only PRs (no path filter in `ci.yml`) — a path filter, an owner change to a protected
  workflow, removes this.
- The heavy-use load test is not automated (docs/IMPLEMENTATION.md request 13) — the owner answering request 13
  removes this.
- The ≥ 15 % headroom rule and the "test twice" gate are written only here, from the orchestrator's report — a test
  helper that enforces the headroom removes the first.
- Red-CI root causes are the orchestrator's reading — tagging each red run with its cause in the item's log removes
  this.
