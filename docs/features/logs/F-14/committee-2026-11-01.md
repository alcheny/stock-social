# F-14 sync cadence · committee · 2026-11-01

Feature: `docs/features/F-14-sync-cadence.md` (Status: ready; its decisions were approved by the approval council). This
committee decides how to build it. Members: business lead, engineer, reliability reviewer (fresh-context subagents);
the sharded-sync session chairs. The chair's proposal: per-account read timestamps in `broker_accounts`, a gate in
`syncUser` before each vendor read, the consented import untouched, timestamps written in the sync's transaction.

## Round 1

- **Business lead: OBJECT on one point (TR-4).** Positions refresh every 6 h and closed trades every 24 h, so a position
  closed at a loss could drop out of "Open" up to 18 h before its closed trade appears: the loss would be nowhere on the
  profile. Demand: a round that reads positions but not activities may update or add positions but never remove one.
  S1 sign (share moves daily, by the guidance), S2 sign (the freshness line stays honest), S3 fewer shards, S4 sign, S5
  sign.
- **Reliability reviewer: OBJECT, five changes.**
  1. The database clock only, and a timestamp in the future counts as due.
  2. A read that succeeded but rolled back (a later step failed) must not let backoff re-read 5 times a day: commit an
     attempt mark outside the transaction after a successful read, with a 6 h floor (at most 4 reads in 24 h).
  3. The same TR-4 point as the business lead.
  4. Keep 40 × 6 (first deploy, an outage or a reconnect wave makes every account due at once).
  5. Observability: read counts per run, a 24 h activities-reads ÷ connected-accounts ratio with `capBreach` over 1.05,
     the oldest read ages (alarms at 26 h and 8 h).

  S4: keep the account list hourly, and add it to the vendor questions (MR-1). S5: test a reconnect.
- **Engineer: OBJECT, six changes.**
  1. Find the account's connection through the consent snapshot (`connections.accounts` of connected connections, the
     latest `connected_at`), not `broker_accounts.connection_id`, which `syncUser`'s claim never sets.
  2. The database clock (shifted by the test hook) for every read and write.
  3. Delete positions of accounts no longer real on every sync, as `replacePositions` did.
  4. Rebuild also when the claim changes an account's paper flag or the account set.
  5. The runner's due count is an estimate; the metered broker pays any difference; one shared SQL fragment for the gate.
  6. An honest test: 48 hourly rounds through the real runner and the vendor fake with per-account counts; ≤ 1
     activities read in any 24 h window and ≥ 1 every 25 h (liveness); a reconnect, a forced failure and a paper flip.

  S1–S5 as the others, S3 keep 40 × 6. Pitfall: reads drift to about every 25 h (positions 7 h) on hourly rounds.

## Decisions (chair's synthesis; round 2 sign-off below)

| # | Decision | Reason |
|---|---|---|
| G1 | Per real account: activities (and share moves, S1) are due when `activities_read_at` is null, at or before the database clock − 24 h, more than 5 min in the future, or before the account's consent (the latest `connected_at` of a connected connection whose snapshot lists it); and the attempt mark (below) is null, at or before − 6 h, in the future, or before that consent. Positions are due on the same rule with 6 h, **and whenever activities are due**. | The approved caps; the engineer's join; the reliability clock rules. Reading positions with every activities read keeps removals aligned with the closed trades (TR-4) at no cost to the cap (≤ 5 position reads a day only if a consent intervenes). |
| G2 | Timestamps are written with the database clock inside `syncUser`'s transaction, so any failure rolls them back (a failed call never advances them, approved). After a successful activities read, an **attempt mark** is written outside the transaction once it ends, whatever its outcome, in its own table (`sync_read_marks`, keyed by user and account), so a sync whose later step keeps failing reads activities at most every 6 h. | Reliability 2. Own table, written after the transaction: no lock or connection is needed while the sync's transaction is open. |
| G3 | A positions read on a round without an activities read for that account **adds and updates** positions and never removes one; a round that read activities replaces that account's positions. Positions of accounts no longer real (disconnected, simulated) are removed on every sync. | Business lead and reliability (TR-4); engineer 3. |
| G4 | The rebuild runs only when activities were read, or the claim changed the account set or a paper flag, or TR-5 disconnected a connection. So `last_synced_at` (the freshness line F-11 reads, the queue order and the coverage age) means "activities last read". The future-date quarantine is re-checked at the next daily read. | S2 signed by all; engineer 4. |
| G5 | The consented import (`importStep`) is untouched and never writes the timestamps; its first hourly sync is due by G1's consent clause; a reconnect makes the next sync read once, then the caps resume. Nothing in "Importing your record" waits. | The approved decision; S5. |
| G6 | `listAccounts` stays every round (TR-5, the claim; 1 request); whether it may be throttled is added to the vendor questions (MR-1) for the owner. | S4. |
| G7 | The shard runner prepays and plans with the due request count from the same SQL rule (1 + 2 × activities-due + positions-due), an estimate; the metered broker pays any difference. | Engineer 5. |
| G8 | Plan: keep 40 × 6 at 12 req/s (the worst hour, every account due at once, still costs about 5.5 requests a trader). docs/SYNC.md reports the steady-state load (about 1.4 requests per trader-hour) and the larger headroom. | Reliability 4, engineer S3 (2 of 3; the business lead's fewer-shards option would fail the all-due hour). |
| G9 | Observability: each run counts account-list, activities and positions reads (counts only); an hourly bucket table sums them; the coverage report adds the 24 h activities-reads ÷ connected-real-accounts ratio with `capBreach` above 1.05, and the oldest activities and positions read ages (alarms above 26 h and 8 h); the stalest-sync alarm moves to 26 h. | Reliability 5. |
| G10 | Tests: the engineer's 48-round test through the real runner and the in-repo vendor fake (per-account request counts) with caps, liveness, reconnect, forced failure and paper flip; the TR-4 test (a position closed at a loss is never absent from both lists); a future timestamp syncs; a rebuild that always fails reads activities at most 4 times in 24 h; the existing sync tests pass. | All three. |

Freshness to document: with hourly rounds and strict caps, activities are read about every 25 h and positions about
every 7 h.

## Round 2

All three found the same flaw in G1: forcing a positions read with every activities read can make 5 positions reads in
24 h once rounds drift (positions at 0, 6, 12, 18 h and a forced read at 20–22 h). Proposed fixes: restart the clock or
skip the forced read (business lead); hold activities until positions are due, reads every 25–31 h (reliability); a
4-read sliding window, deferring activities when it is full (engineer). Also: the attempt mark must cover positions too
(reliability: a rolled-back sync would otherwise re-read positions every hour); `syncUser` must record the successful
reads even when it throws, and the mark write is fire-and-forget (reliability, engineer); `sync_read_marks` keyed by
user and account with a cascade from `users` (engineer, already so).

**Chair's rule (round 3 below), G1 amended:**
- Every successful vendor positions read is recorded in `sync_read_marks.positions_reads` (the last 4, database
  clock), written after the transaction ends whatever its outcome. So the window counts real vendor calls, rolled-back
  ones included (reliability 2).
- A positions read on its **own clock** needs the last read 6 h old **and at most 2 reads in the trailing 24 h**. A
  read **forced** by an activities read needs fewer than 4 in the trailing 24 h.
- Why the forced read always has a slot (so activities are never deferred and stay at about 25 h): take a forced read
  at f, and let y be the last read before it inside (f − 24 h, f).
  - If y was an own-clock read, its own rule allowed at most 3 reads in (y − 24 h, y], which covers (f − 24 h, y]. So
    at most 3 reads precede f, and f makes 4.
  - If y was forced, it came with an activities read at least 24 h before f, so it lies outside the window.

  A window ending at an own-clock read holds at most 3 reads. So any 24 h window holds at most 4 positions reads.
- A consent (a new import or a reconnect) still reads at once, outside the cap (the approved exemption).
- Activities keep their 24 h clock, plus a 6 h floor from `sync_read_marks.activities_attempted_at` (G2).

## Round 3 (signed)

- **Business lead: SIGN**, with a test: the forced read can find the window full after a consent read, and then
  activities wait too (never read without their positions read, or G3's removal comes apart from the rebuild).
- **Engineer: SIGN with an amendment.** The cap holds more simply than the written proof: a window ending at a forced
  read admits it only with fewer than 4 before it, and one ending at an own-clock read with at most 2 before it, so
  every 24 h window holds at most 4. The "forced read always has a slot" claim is false when syncs roll back, since
  only the 6 h attempt floor then spaces the forced reads (forced at 0, 7, 13 and own at 6 → forced at 19 has no slot).
  Amendment: then defer that round's activities read.
- **Reliability reviewer: OBJECT narrowly, same counterexample, then SIGN with both changes taken.** (1) When the
  forced read is refused, defer activities to a later round and count it (`activitiesDeferred`). Activities are never
  deferred unless rollbacks occur. (2) The own-clock "last read 6 h old" reads the last of
  `sync_read_marks.positions_reads`, not `positions_read_at` (which rolls back). Already so in the code.

**Final rule.**
- On a consent, both are read at once (the approved exemption, recorded like any read).
- Otherwise, if activities are due:
  - with fewer than 4 positions reads in the trailing 24 h, both are read;
  - with 4, neither is read: activities are deferred and counted (only while syncs keep rolling back).
- Otherwise, positions are read on their own clock (6 h old and at most 2 in the trailing 24 h).
- The trailing window is `> t − 24 h` in the SQL and the tests alike.

**Signed: business lead, engineer, reliability reviewer (round 3).**
