// F-7 operator CLI (legal C13, C14); prints counts only. node --env-file=.env scripts/public-filer.ts
//   hide|unhide|remove <filer id | handle> [request|review|error|amendment]  |  --dry-run [YYYY-MM-DD] (writes nothing)
import { sql } from '../lib/db.ts';
import { FILER_ACTIONS, filerAction, importPublicFilings } from '../lib/public-import.ts';

const [cmd, who, reason = 'request'] = process.argv.slice(2);
try {
  if (cmd === '--dry-run') {
    const r = await importPublicFilings({ boxMs: 3_600_000, dryRun: true, from: who, max: 100_000 });
    console.log(JSON.stringify({ filers: r.filers, withPricedClose: r.priced, withFivePlus: r.five, excluded: r.excluded, skippedRoles: r.roleSkipped, skippedDocs: r.docsSkipped, stopped: r.stopped }));
  } else if ((FILER_ACTIONS as readonly string[]).includes(cmd) && who) {
    const [f] = /^\d+$/.test(who) ? [{ id: Number(who) }] : await sql`select public_filer_id as id from users where handle = ${who} and public_filer_id is not null`;
    console.log(JSON.stringify({ action: cmd, done: !!f && (await filerAction(f.id, cmd as (typeof FILER_ACTIONS)[number], reason)) }));
  } else {
    console.error('usage: public-filer.ts hide|unhide|remove <filer id | handle> [reason] | --dry-run [YYYY-MM-DD]');
    process.exitCode = 2;
  }
} finally {
  await sql.end({ timeout: 1 });
}
