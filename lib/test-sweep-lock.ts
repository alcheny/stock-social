// Test helper (not a test file): keeps the connection tick's global sweep off a test's backdated importing row.
//
// lib/connections.ts#tick is global by design: it applies the clocks to every connection (applyClocks(now), unscoped:
// an importing row with no progress for 24 h becomes failed, reason 'stale') and drives every importing row with the
// caller's vendor deps. lib/connections.test.ts calls it while other test files run against the same database. A test
// that imports on a shifted clock holds an importing row that a tick on the real clock sees as long stale:
// lib/sync-cadence.db.test.ts imports in hours it claims thousands of hours back (lib/sync-test-hours.ts), and it flaked
// that way ("consent exemption": the import ended failed, reason stale, instead of connected).
//
// So every global tick in a test runs inside `sweeping` (the lock in shared mode: ticks still overlap each other), and a
// test that holds an importing row on a shifted clock does that inside `unswept` (exclusive): no global tick runs while it
// holds the lock, and it waits for the ticks in flight to end. A session advisory lock on a connection reserved for the
// call: released at the end, or by the server if the process dies. lib/test-sweep-lock.test.ts checks that no test file
// calls the tick outside `sweeping`.
// ponytail: only test code takes the lock (the tick itself does not) — a test file that reaches the tick another way (the
// cron route) must wrap that call too; the check above looks for the tick imported from lib/connections.ts only.
const KEY = 'lib/test-sweep-lock.ts';

async function hold<T>(exclusive: boolean, fn: () => Promise<T>): Promise<T> {
  const { sql } = await import('./db.ts');
  const conn = await sql.reserve();
  try {
    if (exclusive) await conn`select pg_advisory_lock(hashtextextended(${KEY}, 0))`;
    else await conn`select pg_advisory_lock_shared(hashtextextended(${KEY}, 0))`;
    try {
      return await fn();
    } finally {
      if (exclusive) await conn`select pg_advisory_unlock(hashtextextended(${KEY}, 0))`;
      else await conn`select pg_advisory_unlock_shared(hashtextextended(${KEY}, 0))`;
    }
  } finally {
    conn.release();
  }
}

/** Runs a global connection tick (or anything else that sweeps every connection) in shared mode. */
export const sweeping = <T>(fn: () => Promise<T>) => hold(false, fn);
/** Runs `fn` while no global sweep runs: for a test's importing row on a shifted clock. Keep it short: ticks wait. */
export const unswept = <T>(fn: () => Promise<T>) => hold(true, fn);
