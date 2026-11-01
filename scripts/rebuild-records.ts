// Fixes cycle 3 (docs/features/logs/fixes-cycle3/committee-2026-11-01.md): after a matcher change (lib/trades.ts) every
// record is recomputed from its raw activities. The hourly sync rebuilds the traders it reads; a trader whose every
// connection is frozen (TR-5) is no longer read, so this one-off rebuilds every profile, one transaction each, under the
// trader's sync lock. Prints counts only (POLICY P3/P6).
//   node --env-file=.env scripts/rebuild-records.ts
import { sql } from '../lib/db.ts';
import { rebuildTrades, USER_LOCK } from '../lib/sync.ts';

// `scope` is a test hook (only these profiles); the command line passes none.
export async function run(out: (line: string) => void = console.log, scope?: number[]): Promise<{ rebuilt: number; failed: number }> {
  const ids = (await sql`select id from users where deleted_at is null ${scope ? sql`and id in ${sql(scope.length ? scope : [-1])}` : sql``} order by id`).map((r) => r.id as number);
  let rebuilt = 0, failed = 0;
  for (const id of ids) {
    try {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${id})`;
        await rebuildTrades(id, tx);
      });
      rebuilt++;
    } catch {
      failed++; // never stops the rest; no id is printed
    }
  }
  out(`rebuilt records: ${rebuilt}, failed: ${failed}`);
  return { rebuilt, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await run();
  } finally {
    await sql.end({ timeout: 1 });
  }
}
