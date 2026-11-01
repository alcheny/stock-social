// F-16 (plan docs/features/logs/F-16-F-17/plan.md §5.3): the owner's audited hide and unhide, run on the owner's machine:
//   node --env-file=.env scripts/hide.ts profile <user_id> <reason>
//   node --env-file=.env scripts/hide.ts thesis <user_id> <sell_id> <reason>
//   node --env-file=.env scripts/hide.ts unhide-profile <user_id> <unhide-reason>
//   node --env-file=.env scripts/hide.ts unhide-thesis <user_id> <sell_id> <unhide-reason>
//   node --env-file=.env scripts/hide.ts history <user_id>
// Options: --actor=<role word> (else env TRUST_ACTOR, else 'owner'). The actor never comes from a session.
// Only a whole profile or a thesis can be hidden; anything else (a trade, a card, a month) exits 2 and writes nothing.
// Every change writes one trust_audit row in the same transaction. Nothing is removed: an unhide restores.
// Output goes to the owner's terminal only.
import { HIDE_REASONS, UNHIDE_REASONS, REFUSED_KIND, RefusedInput, hideHistory, hideProfile, hideThesis, isHideReason, isUnhideReason, unhideProfile, unhideThesis, type HideDeps } from '../lib/trust-hide.ts';

export type Out = (line: string) => void;
const USAGE = 'usage: hide.ts profile <user_id> <reason> | thesis <user_id> <sell_id> <reason> | unhide-profile <user_id> <unhide-reason> | unhide-thesis <user_id> <sell_id> <unhide-reason> | history <user_id>  [--actor=<role>]';
const COMMANDS = ['profile', 'thesis', 'unhide-profile', 'unhide-thesis', 'history'];
const UID = /^[0-9]{1,10}$/;

/** The CLI, testable: returns the exit code. `deps` reaches the library (tests inject a failing audit). */
export async function run(argv: string[], out: Out, env: Record<string, string | undefined> = process.env, deps?: HideDeps): Promise<number> {
  const flag = argv.find((a) => a.startsWith('--actor='));
  const actor = flag ? flag.slice('--actor='.length) : (env.TRUST_ACTOR || 'owner');
  const args = argv.filter((a) => !a.startsWith('--'));
  const [cmd, uid] = args;
  if (!cmd) { out(USAGE); return 2; }
  if (!COMMANDS.includes(cmd)) { out(REFUSED_KIND); out(USAGE); return 2; }
  if (!UID.test(uid ?? '')) { out(USAGE); return 2; }
  const userId = Number(uid);
  const thesis = cmd === 'thesis' || cmd === 'unhide-thesis';
  const want = cmd === 'history' ? 2 : thesis ? 4 : 3;
  if (args.length !== want) { out(USAGE); return 2; }
  const sellId = thesis ? args[2] : '';
  const reason = args[want - 1];
  try {
    if (cmd === 'history') {
      const rows = await hideHistory(userId);
      if (!rows.length) out('No hides or unhides for that user id.');
      for (const r of rows) out(`${r.at.toISOString()}\t${r.action}\t${r.kind}${r.sell_id ? `\t${r.sell_id}` : ''}\t${r.reason}\t${r.actor}`);
      return 0;
    }
    const hiding = cmd === 'profile' || cmd === 'thesis';
    if (hiding ? !isHideReason(reason) : !isUnhideReason(reason)) {
      out(`Unknown reason. One of: ${(hiding ? HIDE_REASONS : UNHIDE_REASONS).join(', ')}`);
      return 2;
    }
    let ok: boolean;
    if (cmd === 'profile') ok = await hideProfile(userId, reason as never, actor, deps);
    else if (cmd === 'thesis') ok = await hideThesis(userId, sellId, reason as never, actor, deps);
    else if (cmd === 'unhide-profile') ok = await unhideProfile(userId, reason as never, actor, deps);
    else ok = await unhideThesis(userId, sellId, reason as never, actor, deps);
    const done = { profile: 'Profile hidden.', thesis: 'Thesis hidden.', 'unhide-profile': 'Profile shown again.', 'unhide-thesis': 'Thesis shown again.' }[cmd]!;
    const none = {
      profile: 'Not hidden: no such visible profile.', thesis: 'No published thesis with that user id and sell id.',
      'unhide-profile': 'Not changed: that profile is not hidden.', 'unhide-thesis': 'No hidden thesis with that user id and sell id.',
    }[cmd]!;
    out(ok ? done : none);
    return ok ? 0 : 1;
  } catch (e) {
    if (e instanceof RefusedInput) { out(e.message); return 2; }
    throw e;
  }
}

if (import.meta.main) {
  const { sql } = await import('../lib/db.ts');
  const code = await run(process.argv.slice(2), (l) => process.stdout.write(`${l}\n`));
  await sql.end({ timeout: 1 });
  process.exit(code);
}
