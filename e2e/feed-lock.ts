// F-1 PR-3 fix round 7: the feed (`/`) is one shared page over one shared database, and the spec files run in parallel
// workers. The heavy-feed test (app.spec.ts) fills all 50 cards with its own traders for a few seconds, and the connect
// tests that look for their own trader in the feed (connect.spec.ts) would miss it meanwhile (and theirs would take
// cards from the heavy test). A database advisory lock keeps them apart: the heavy test holds it exclusively, the
// others hold it shared, so the feed tests still run in parallel with each other. Shared too: a test whose fixture is
// feed-eligible (similar.spec.ts) or that reads the demo records' feed cards and pages (follow.spec.ts). Session-level, on its own connection,
// released by `release()` or when the connection ends.
import postgres from 'postgres';

const FEED_LOCK = 7_310_001;

export async function feedLock(mode: 'shared' | 'exclusive'): Promise<() => Promise<void>> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  if (mode === 'exclusive') await sql`select pg_advisory_lock(${FEED_LOCK})`;
  else await sql`select pg_advisory_lock_shared(${FEED_LOCK})`;
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    await sql.end({ timeout: 1 }); // ends the session, which releases the lock
  };
}
