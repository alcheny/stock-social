// F-16 (plan docs/features/logs/F-16-F-17/plan.md §5.6): the owner's trust-and-safety digest, in the owner's terminal:
//   node --env-file=.env scripts/trust-digest.ts                      # counts and links, under-18 first
//   node --env-file=.env scripts/trust-digest.ts reports <trader_id>  # one profile's reports (reporter ids, owner only)
//   node --env-file=.env scripts/trust-digest.ts resolve <reporter_id> <trader_id> founded|unfounded
//   node --env-file=.env scripts/trust-digest.ts reporters            # reporter ids with 2+ unfounded reports
// No session, no page, no email: it prints to the terminal and never to a server log. Resolving a report changes only
// that report; hiding is scripts/hide.ts, the owner's separate decision.
import { digest, formatDigest, reportsOn, repeatUnfounded, resolveReport, isResolution } from '../lib/trust-digest.ts';
import { siteUrl } from '../lib/ticker.ts';

export type Out = (line: string) => void;
const USAGE = 'usage: trust-digest.ts | reports <trader_id> | resolve <reporter_id> <trader_id> founded|unfounded | reporters';
const ID = /^[0-9]{1,10}$/;

/** The CLI, testable: returns the exit code. */
export async function run(argv: string[], out: Out, env: Record<string, string | undefined> = process.env): Promise<number> {
  const [cmd, a, b, c] = argv;
  if (argv.length === 0) {
    for (const l of formatDigest(await digest(), siteUrl(env))) out(l);
    return 0;
  }
  if (cmd === 'reports' && argv.length === 2 && ID.test(a)) {
    const rows = await reportsOn(Number(a));
    if (!rows.length) out('No profile reports for that trader id.');
    for (const r of rows) out(`${r.reporterId}\t${r.category}\t${r.at.toISOString()}\t${r.resolution ? `${r.resolution} ${r.resolvedAt?.toISOString()}` : 'open'}`);
    return 0;
  }
  if (cmd === 'resolve' && argv.length === 4 && ID.test(a) && ID.test(b) && isResolution(c)) {
    const ok = await resolveReport(Number(a), Number(b), c);
    out(ok ? `Resolved (${c}).` : 'No open profile report from that reporter on that trader.');
    return ok ? 0 : 1;
  }
  if (cmd === 'reporters' && argv.length === 1) {
    const rows = await repeatUnfounded();
    if (!rows.length) out('No reporter has 2 or more unfounded reports.');
    for (const r of rows) out(`${r.reporterId}\tunfounded: ${r.unfounded}`);
    return 0;
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
