// fix-user-text B (F-9, POLICY U1): the owner's release path for held theses. Run by the owner on their own machine:
//   node --env-file=.env scripts/review-theses.ts list [user_id]
//   node --env-file=.env scripts/review-theses.ts publish <user_id> <sell_id>
//   node --env-file=.env scripts/review-theses.ts keep <user_id> <sell_id>
// `publish` makes a held thesis public and marks it released (the start-up re-check skips it until the trader edits
// it); `keep` marks it reviewed and leaves it held. Neither deletes anything. `list` prints the held theses with their
// text so the owner can decide: it writes to the owner's terminal only, never to a server log.
// ponytail: an owner-run CLI with database access is the only admin identity today — move this to an admin page once
// real admin identity exists (app/review/theses/page.tsx is that page, behind REVIEW_QUEUE).
import { listHeld, releaseThesis, type Decision } from '../lib/thesis-review.ts';

export type Out = (line: string) => void;
const USAGE = 'usage: review-theses.ts list [user_id] | publish <user_id> <sell_id> | keep <user_id> <sell_id>';
// ponytail: `list` shows the first LIST_CAP held theses (by trader, then sell id), with a line saying so when it is
// full — page with a `from <user_id>` cursor if the queue ever outgrows it.
export const LIST_CAP = 200;

/** The CLI, testable: returns the exit code. */
// Fix round 4: `cap` is a parameter so a test can reach the "first N shown" line; one extra row is read so the line is
// printed only when more held theses exist than are shown.
export async function run(argv: string[], out: Out, cap = LIST_CAP): Promise<number> {
  const [cmd, uid, sellId] = argv;
  // Fix round 3 (item 11): `list <user_id>` narrows the list to one trader.
  if (cmd === 'list' && (argv.length === 1 || (argv.length === 2 && /^[0-9]{1,10}$/.test(uid)))) {
    const all = await listHeld(cap + 1, argv.length === 2 ? Number(uid) : undefined);
    if (!all.length) { out('No held theses.'); return 0; }
    const rows = all.slice(0, cap);
    for (const r of rows) {
      out(`${r.userId}\t${r.sellId}\t@${r.handle}\t${r.symbol ?? '(trade not shown)'}\trule: ${r.rule ?? 'none'}\treports: ${r.reports}${r.reviewed ? '\t(reviewed, kept held)' : ''}`);
      out(`\t${JSON.stringify(r.thesis)}`);
    }
    if (all.length > cap) out(`(first ${cap} shown; pass a user id to narrow the list)`);
    return 0;
  }
  if ((cmd === 'publish' || cmd === 'keep') && argv.length === 3 && /^[0-9]{1,10}$/.test(uid) && sellId) {
    const ok = await releaseThesis(Number(uid), sellId, cmd as Decision);
    out(ok ? (cmd === 'publish' ? 'Published.' : 'Kept held (reviewed).') : 'No held thesis with that user id and sell id.');
    return ok ? 0 : 1;
  }
  out(USAGE);
  return 2;
}

if (import.meta.main) {
  const { sql } = await import('../lib/db.ts');
  const code = await run(process.argv.slice(2), (l) => process.stdout.write(`${l}\n`));
  await sql.end({ timeout: 1 });
  process.exit(code);
}
