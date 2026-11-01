// Sharded sync (code review nit 4): the cron endpoint's housekeeping (the connections tick, deletions) is shared state
// across spec files, which run in parallel workers. A test that asserts on one cron call's effect (connect.spec.ts
// `tick`, privacy-gate.spec.ts) holds this lock shared for the call; the sharded-sync spec, which makes several calls
// of its own, holds it exclusively, so its calls never interleave with another file's. Session-level, on its own
// connection, released by `release()` or when the connection ends (like e2e/feed-lock.ts).
import postgres from 'postgres';

const CRON_LOCK = 7_310_002;

export async function cronLock(mode: 'shared' | 'exclusive'): Promise<() => Promise<void>> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  if (mode === 'exclusive') await sql`select pg_advisory_lock(${CRON_LOCK})`;
  else await sql`select pg_advisory_lock_shared(${CRON_LOCK})`;
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    await sql.end({ timeout: 1 });
  };
}
