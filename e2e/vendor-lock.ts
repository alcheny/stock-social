// OPTIONS fix round 3: the in-repo vendor fake listens on one fixed port (4102, the port the app server is pointed at),
// and the spec files run in parallel workers. connect.spec.ts holds the fake for its whole file; e2e/options.spec.ts
// starts its own for one test. A database advisory lock (its own key, beside e2e/feed-lock.ts's) lets them take the port
// in turn, never at once. Session-level, on its own connection, released by `release()` or when the connection ends.
import postgres from 'postgres';

// Its own key (fix round 5: 7_310_002 is e2e/cron-lock.ts's, and connect.spec's tick() waited on its own vendor lock).
export const VENDOR_LOCK = 7_310_003;

export async function vendorLock(): Promise<() => Promise<void>> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql`select pg_advisory_lock(${VENDOR_LOCK})`;
  let done = false;
  return async () => {
    if (done) return;
    done = true;
    await sql.end({ timeout: 1 }); // ends the session, which releases the lock
  };
}
