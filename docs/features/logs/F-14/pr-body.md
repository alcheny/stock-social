## What changes

Builds **F-14 sync cadence** (`docs/features/F-14-sync-cadence.md`, Status: ready, approved by the approval council). The
hourly cron, `/connect/done`, the 7-day re-read and `vercel.json` are unchanged. A per-account gate in the shard runner's
sync keeps each account within the vendor's guidance:

- **Activities**, with the share moves from #40 (same vendor endpoint), are read at most **once per 24 h** per account.
  On hourly rounds a record's trades are about 25 h fresh at worst.
- **Positions** are read at most **4 times in any 24 h**:
  - on their own 6 h clock while at most 2 reads fall in the trailing 24 h;
  - always together with an activities read.

  If the window is full, which happens only while syncs keep rolling back, activities wait too (`readsDeferred`).
- **Never throttled:** the consented import (`importStep`, untouched) and the first sync after any consent (a new import
  or a reconnect). "Importing your record" never waits.
- **TR-4 (no vanishing losses):**
  - A positions-only read adds and updates positions and never removes one.
  - A read with activities removes a position the vendor stopped listing only once its sell is imported (its closed
    trade is published in the same transaction), or after 3 days unlisted (a transfer out).
  - Positions of accounts no longer real (disconnected, simulated) go on every sync.
- **Timestamps** (`broker_accounts.activities_read_at`, `positions_read_at`):
  - On the database clock, written inside the sync's transaction after the vendor calls, so a failed call never
    advances them.
  - Null, future or pre-consent timestamps mean "read now". A future `connected_at` is ignored.
- **Every successful vendor read** is also recorded after the transaction, whatever its outcome (`sync_read_marks`), so
  a sync that keeps failing reads activities at most every 6 h and positions within the same window.
- **The rebuild** runs only after an activities read, or when the account set, a paper flag or a connection changed, so
  `users.last_synced_at` (what F-11's freshness line reads) means "trades last read".
- **The shard runner** plans each trader's vendor budget from its due reads (`dueRequestsSql`); the metered broker pays
  any difference.
- **Evidence:**
  - Each run logs `accountLists`, `activitiesReads`, `positionsReads` and `readsDeferred`, summed hourly in
    `sync_read_counts`.
  - The coverage line adds `capRatio` (activities reads in 24 h ÷ accounts still read), `capBreach` above 1.05, the
    oldest activities and positions reads, and `freshnessAlarm` above 26 h and 18 h.
- **Load:** about 1.4 vendor requests per trader-hour in steady state, against about 5.5 when every account is due. The
  40 × 6 plan in `docs/SYNC.md` stays sized for the all-due hour (the first deploy, after an outage, a reconnect wave).
- **Without `cadence`** (`syncTick`, the existing tests), `syncUser` behaves exactly as before. Only the runner's
  production sync opts in.

Files: new `lib/sync-cadence.ts` and three test files; edits in `lib/sync.ts#syncUser`, `lib/sync-shard.ts`, an additive
`lib/positions.ts#settleAccountPositions`, `db/schema.sql` (appended, idempotent), privacy maps, `docs/SYNC.md`, and
additive controls in `e2e/fakes/vendor.ts` (`/_fail` `match`, `/_accounts`, per-account `/_stats`).

**For the owner (protected docs):** CLAUDE.md "Architecture → Sync paths" and DESIGN §2.7 describe an hourly sync. After
this, the cron is still hourly, but each account is read within the caps above (activities about every 25 h, positions
up to 4 a day). Suggested line: "`POST /api/sync` runs hourly; each account's activities are read at most once a day and
its positions at most 4 times a day (F-14, docs/SYNC.md → Read cadence)."

## Decisions taken by the committee

The committee was the business lead, the engineer and a reliability reviewer, in three rounds, all signed. The log is
`docs/features/logs/F-14/committee-2026-11-01.md`.

- **S1 (the open question from #46):** share moves are read daily with activities. They come from the same vendor
  endpoint, so the approved cap applies to them; this is not a product preference.
- **S2:** rebuild only after an activities read, so the freshness line stays honest.
- **S3:** keep the 40 × 6 plan, decided 2 to 1. The business lead preferred fewer shards and conceded: the all-due hour
  sets the size.
- **S4:** the account list stays hourly (TR-5, the claim). Whether it may be throttled is a vendor question for the owner.
- **S5:** nothing in the import waits.
- **TR-4** (business lead and reliability): positions-only reads never remove a position.
- **Cap safety** (round 2, all three): the trailing-window rule, with the round-3 amendment that activities are deferred
  when a forced positions read finds the window full.
- **Rollback safety** (reliability): marks outside the transaction.
- **Correctness** (engineer): the consent snapshot join, the database clock, removing positions of gone accounts,
  rebuilding on account or paper changes, an honest 48-round test.
- **Code review** (independent):
  - activities read one account per call, each marked as it returns;
  - a combined read keeps a vanished position until its sell is imported;
  - coverage counts only accounts still read;
  - a future `connected_at` is ignored.

## Known limits (each marked `ponytail:` at its place)

- `lib/sync.ts`: the account list (`listAccounts`) is still read every round, because it carries the claim and TR-5's
  disconnect check. Fix: throttle it if the vendor's written answer (MR-1) allows.
- `lib/sync.ts`: the future-date quarantine is re-checked only when activities are read (about every 25 h), so a date
  the vendor corrects appears up to a day later. Fix: a nightly rebuild-only pass.
- An account whose sync rolls back after its activities read can be read again after the 6 h floor, up to 4 times a day
  (G2). The spec's "at most 1 activities call per 24 h" holds whenever syncs commit; the 48-round test asserts both
  bounds.
- Positions can go about 12–17 h unread between the read an activities read forces and the next one (the own-clock
  rule leaves room for the forced read). The freshness alarm is set to 18 h accordingly.

## Testing

- `npx tsc --noEmit`: clean.
- `npm test`, run twice after merging the latest main: **1176 tests, 1155 pass, 0 fail** both times (1 owner todo;
  the rest skipped opt-in LOAD tests). New:
  - `lib/sync-cadence.test.ts` (13 unit tests): the decision rule, the committee's counterexamples, 30 days of hourly
    rounds, 40 random seeds with rollbacks, missed rounds, reconnects and jitter.
  - `lib/sync-cadence.db.test.ts` (8 DB tests against the in-repo vendor fake over HTTP through the real
    `lib/broker.ts`):
    - 48 hourly rounds through the real runner, with a missed round and two rollbacks: per account ≤ 1 activities and
      ≤ 1 share-move read in any 24 h (a rolled-back read retried after the 6 h floor is the only extra) and ≤ 4
      positions reads; liveness at 26 h and 14 h; deferrals only after rollbacks; run counters equal the vendor's.
    - The consent exemption: a reconnect is read at once; `importStep` reads whatever the timestamps say; its first
      hourly sync reads and the next does not.
    - A failed call (no advance), null and future timestamps.
    - An always-failing rebuild: ≤ 4 activities and ≤ 4 positions reads in 24 h.
    - TR-4: a −20% position never missing from both lists; a paper flip and an unlisted account.
    - The business lead's reconnect condition.
    - Coverage: `capRatio`, `capBreach`, ages, alarms, a numbers-only log.
    - `dueSql` against the model in 300 random states.
  - `lib/sync-cadence.review.test.ts` (4 DB tests): one regression test for each code-review fix.

  Two existing runner tests were adapted to the new cadence, with the same intent:
  - `lib/sync-shard.test.ts` "failure isolation": the 403 step now runs when activities are due again (a day later).
  - The 3-account route-end guard test uses the non-cadence sync, which still issues one 3-request call.
- The tester found and fixed six bugs before review, listed in the committee log's tester notes:
  - the consent clause ignored the attempt mark;
  - future positions marks were kept;
  - first-sync pages were not counted;
  - the coverage window had no upper bound;
  - `-infinity` arithmetic failed on Postgres 16;
  - two existing CI rules (privacy logs, the `delete from` allow-list in `lib/sync.ts`) were broken.
- `npm run build`: ok. `node scripts/autopilot.ts guard origin/main`: ok. `BASE_REF=main node scripts/compliance.ts
  auto`: the only finding is `node_modules/@img/sharp-wasm32`, from main's lockfile.
- **Full Playwright suite:** **195 passed, 6 skipped, 1 failed**. The failure is `e2e/connect.spec.ts:945` (the S3
  dialog's keyboard focus trap). It is not this PR's: it fails 2 of 3 runs on its own here and **also fails 2 of 3 on a
  clean build of `origin/main`** (checked in a separate worktree). This PR touches no app or connect code.
- `vercel.json`: unchanged (no such file in the repo; the cron schedule is the owner's deploy setting, docs/SYNC.md).

## Compliance

1. **Performance shown, ranked or described?** No display change. Records update about daily instead of hourly; F-11's
   freshness line (merged before or with this) says how fresh they are. No loss is hidden: TR-4 is enforced and tested.
2. **Personal data?**
   - `broker_accounts` gains two timestamps.
   - New `sync_read_marks` (user id, vendor account id, the last read times) is deleted with the user (cascade) and in
     SCHEMA_MAP and privacy-fields.
   - `sync_read_counts` holds counts only.
   - Logs: counts, and the internal user id with `logSafe`; never an account id (POLICY P6).
3. **Money?** No.
4. **Email, push, tracking?** No.
5. **User content?** No.
6. **Sign-up, age, identity?** No.
7. **Vendor, dependency?** No new dependency. The vendor is called less, within its guidance; `lib/broker.ts` is
   untouched.
8. **Accessibility?** No UI change.
9. **Security posture?** Unchanged (the cron endpoint and its secret as before).
10. **Claims?** None. The docs state the cadence and its measured bounds.
11. **Checkout?** No.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Cdty8kUvuYVmt9MLT5SmC6
