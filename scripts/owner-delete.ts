// F-16 follow-up (owner decision 2026-11-02): the owner's audited account deletion, run on the owner's machine:
//   node --env-file=.env scripts/owner-delete.ts <user_id> <reason> --confirm=<current handle> [--actor=<role>]
//   node --env-file=.env scripts/owner-delete.ts history   (the latest deletions: dates, codes and counts; names no one)
// Reasons (lib/owner-delete.ts DELETE_REASONS): under-18-founded, legal-notice, owner-decision.
// --confirm is required and must equal the account's current handle, so a mistyped id deletes nothing.
// Options: --actor=<role word> (else env TRUST_ACTOR, else 'owner'). The actor never comes from a session.
// The deletion is lib/delete.ts#deleteProfile, the settings page's path; its audit row (trust_deletions) commits with the
// account's deletion mark. The owner runs this; never an assistant or an automated job (runbook Section 3).
// Output goes to the owner's terminal only.
import { DELETE_REASONS, RefusedConfirm, deletionHistory, isDeleteReason, ownerDeleteAccount, type OwnerDeleteDeps } from '../lib/owner-delete.ts';
import { RefusedInput } from '../lib/trust-hide.ts';

export type Out = (line: string) => void;
const USAGE = 'usage: owner-delete.ts <user_id> <reason> --confirm=<handle> [--actor=<role>] | history';
const UID = /^[0-9]{1,10}$/;

/** The CLI, testable: returns the exit code. `deps` reaches the library (tests inject a failing audit and no vendor). */
export async function run(argv: string[], out: Out, env: Record<string, string | undefined> = process.env, deps?: OwnerDeleteDeps): Promise<number> {
  const opt = (name: string) => { const f = argv.find((a) => a.startsWith(`--${name}=`)); return f === undefined ? undefined : f.slice(name.length + 3); };
  const actor = opt('actor') ?? (env.TRUST_ACTOR || 'owner');
  const confirm = opt('confirm');
  const args = argv.filter((a) => !a.startsWith('--'));
  if (args[0] === 'history') {
    if (args.length !== 1) { out(USAGE); return 2; }
    const rows = await deletionHistory(undefined, { actor: opt('actor') });
    if (!rows.length) out('No owner deletions.');
    for (const r of rows) out(`${r.at.toISOString()}\tdelete\t${r.reason}\t${r.actor}\ttrades ${r.counts.closed_trades}\tactivities ${r.counts.activities}\tpositions ${r.counts.open_positions}\tnotes ${r.counts.notes}\treports ${r.counts.reports}`);
    return 0;
  }
  const [uid, reason] = args;
  if (args.length !== 2 || !UID.test(uid ?? '')) { out(USAGE); return 2; }
  if (!isDeleteReason(reason)) { out(`Unknown reason. One of: ${DELETE_REASONS.join(', ')}`); return 2; }
  if (!confirm) { out('Refused: --confirm=<handle> is required.'); out(USAGE); return 2; }
  try {
    const ok = await ownerDeleteAccount(Number(uid), reason, confirm, actor, deps);
    const next = reason === 'under-18-founded' ? ' Next: review the sign-up age gate (docs/COMPLIANCE.md Section 7).' : '';
    out(ok ? `Account deleted.${next}` : 'Not changed: no account with that user id.');
    return ok ? 0 : 1;
  } catch (e) {
    if (e instanceof RefusedInput || e instanceof RefusedConfirm) { out(e.message); return 2; }
    throw e;
  }
}

if (import.meta.main) {
  const { sql } = await import('../lib/db.ts');
  const code = await run(process.argv.slice(2), (l) => process.stdout.write(`${l}\n`));
  await sql.end({ timeout: 1 });
  process.exit(code);
}
