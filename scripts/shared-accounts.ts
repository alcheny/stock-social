// The owner's report on broker accounts two profiles already shared before the TR-6 claim existed (lib/shared-accounts.ts).
// Prints counts only: never an account id, user id, handle or symbol (POLICY P3/P6).
//   node --env-file=.env scripts/shared-accounts.ts            report (reads only)
//   node --env-file=.env scripts/shared-accounts.ts --mark     also mark every unmarked case (idempotent; no rebuild)
//   node --env-file=.env scripts/shared-accounts.ts --rebuild  also rebuild every marked profile's record: the marked
//                                                              account's trades and open positions leave that profile
//                                                              (raw activities stay; theses are kept)
// Marking and rebuilding change what public records show, so they are the owner's calls (committee 2026-11-01).
import { sql } from '../lib/db.ts';
import { markedProfiles, markShared, sharedReport } from '../lib/shared-accounts.ts';
import { rebuildTrades, USER_LOCK } from '../lib/sync.ts';

// `scope` is a test hook (only these profiles); the command line passes none.
export async function run(args: string[], out: (line: string) => void = console.log, scope?: number[]): Promise<void> {
  const mark = args.includes('--mark'), rebuild = args.includes('--rebuild');
  const before = await sharedReport(sql, scope);
  out(`shared accounts: ${JSON.stringify(before)}`);
  if (mark) out(`marked now: ${await markShared(sql, scope)}`);
  if (rebuild) {
    let n = 0;
    for (const userId of await markedProfiles(sql, scope)) {
      // The trader's lock, as the hourly sync takes it: never two rebuilds of one record at once.
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${USER_LOCK}, ${userId})`;
        await rebuildTrades(userId, tx);
        await tx`delete from open_positions p using shared_account_marks m
          where p.user_id = ${userId} and m.user_id = p.user_id and m.account_id = p.account_id`;
        await tx`delete from unlisted_positions p using shared_account_marks m
          where p.user_id = ${userId} and m.user_id = p.user_id and m.account_id = p.account_id`;
      });
      n++;
    }
    out(`rebuilt profiles: ${n}`);
  }
  if (mark || rebuild) out(`shared accounts now: ${JSON.stringify(await sharedReport(sql, scope))}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await run(process.argv.slice(2));
  } finally {
    await sql.end({ timeout: 1 });
  }
}
