// F-16 follow-up (owner decision 2026-11-02): the owner's audited account deletion, for a founded "May be under 18"
// report (docs/COMPLIANCE.md Section 7: delete, log, review the gate) and other deletions the owner decides. Run only by
// the owner's CLI (scripts/owner-delete.ts); no route, action or page imports this file (lib/f16-owner-delete.test.ts).
// - One deletion path: this calls lib/delete.ts#deleteProfile, the path the settings page uses. Nothing here removes a
//   row itself.
// - The audit row goes in trust_deletions, not trust_audit: trust_audit.user_id cascades with the users row, and its
//   action CHECK allows only hide/unhide (widening it would need a drop). trust_deletions has no foreign key, so the
//   row outlives the account. OD 2.22: it holds no personal data, only the date, a reason code, a role word and the
//   counts of what was deleted (no user id, handle, email or name).
// - Atomicity: deleteProfile runs in three steps: (1) a transaction that marks the account (deleted_at) and removes
//   the rows naming it, (2) the billing and vendor calls, outside any transaction, (3) a transaction that removes the
//   users row. The audit row is written inside step 1 (DeleteDeps.withMark), together with the confirm check, so a
//   failed audit insert or a wrong --confirm marks and deletes nothing. If step 2 fails, the account stays marked with
//   its audit row, and the hourly tick (or a re-run of the script) finishes the same path.
// - The actor is whatever the CLI was given (an arg or env), never a session.
// ponytail: an owner-run CLI with database access is the only admin identity (as for lib/trust-hide.ts); move to an admin
// page once real admin identity exists.
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { defaultDeleteDeps, deleteProfile, type DeleteDeps } from './delete.ts';
import { ACTOR, RefusedInput } from './trust-hide.ts';

export const DELETE_REASONS = ['under-18-founded', 'legal-notice', 'owner-decision'] as const;
export type DeleteReason = (typeof DELETE_REASONS)[number];
export const isDeleteReason = (v: unknown): v is DeleteReason => typeof v === 'string' && (DELETE_REASONS as readonly string[]).includes(v);

export type DeletionCounts = { closed_trades: number; activities: number; open_positions: number; notes: number; reports: number };
export type DeletionRow = { reason: DeleteReason; actor: string; counts: DeletionCounts };
export type OwnerDeleteDeps = { audit: (tx: TransactionSql, row: DeletionRow) => Promise<unknown>; profile: DeleteDeps };
export const defaultOwnerDeleteDeps: OwnerDeleteDeps = {
  audit: (tx, r) => tx`insert into trust_deletions (reason, actor, closed_trades, activities, open_positions, notes, reports)
    values (${r.reason}, ${r.actor}, ${r.counts.closed_trades}, ${r.counts.activities}, ${r.counts.open_positions}, ${r.counts.notes}, ${r.counts.reports})`,
  profile: defaultDeleteDeps,
};

export const REFUSED_CONFIRM = 'Refused: --confirm must equal the account\'s current handle.';
export class RefusedConfirm extends Error {
  constructor() { super(REFUSED_CONFIRM); this.name = 'RefusedConfirm'; }
}

/**
 * Delete one account through deleteProfile with an audit row. Returns false when no account has that id (nothing is
 * written). Throws RefusedInput on a bad id, reason or actor, RefusedConfirm when `confirm` is not its current handle.
 */
export async function ownerDeleteAccount(userId: number, reason: DeleteReason, confirm: string, actor = 'owner', deps: OwnerDeleteDeps = defaultOwnerDeleteDeps): Promise<boolean> {
  if (!Number.isInteger(userId) || userId <= 0) throw new RefusedInput('user id');
  if (!isDeleteReason(reason)) throw new RefusedInput('deletion reason');
  if (!ACTOR.test(actor)) throw new RefusedInput('actor (a role word such as "owner")');
  const [u] = await sql`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where id = ${userId}`;
  if (!u) return false;
  if (typeof confirm !== 'string' || confirm !== u.handle) throw new RefusedConfirm();
  await deleteProfile({ id: Number(u.id), handle: u.handle, snaptrade_user_id: u.snaptrade_user_id, snaptrade_secret_enc: u.snaptrade_secret_enc }, {
    ...deps.profile,
    // Runs first in deleteProfile's marking transaction: the handle is re-read under a row lock (a rename between the
    // read above and the mark is refused), then the audit row; either failing rolls the mark back.
    withMark: async (tx) => {
      const [now] = await tx`select handle from users where id = ${userId} for update`;
      if (!now || now.handle !== confirm) throw new RefusedConfirm();
      // The counts are read here, before deleteProfile's next statements remove the rows (same transaction).
      const [c] = await tx`select
        (select count(*)::int from closed_trades where user_id = ${userId}) as closed_trades,
        (select count(*)::int from activities where user_id = ${userId}) as activities,
        (select count(*)::int from open_positions where user_id = ${userId}) as open_positions,
        (select count(*)::int from closed_trades where user_id = ${userId} and thesis is not null and thesis <> '') as notes,
        (select count(*)::int from thesis_reports where trader_id = ${userId}) as reports`;
      await deps.audit(tx, { reason, actor, counts: { closed_trades: c.closed_trades, activities: c.activities, open_positions: c.open_positions, notes: c.notes, reports: c.reports } });
    },
  });
  return true;
}

export type DeletionEntry = DeletionRow & { at: Date };
export const HISTORY_LIMIT = 50;
/** The latest owner deletions, newest first (the CLI's `history`): dates, codes and counts only; it names no one. */
export async function deletionHistory(limit = HISTORY_LIMIT, opts: { actor?: string } = {}): Promise<DeletionEntry[]> {
  const rows = await sql`select reason, actor, closed_trades, activities, open_positions, notes, reports, at from trust_deletions
    ${opts.actor ? sql`where actor = ${opts.actor}` : sql``} order by at desc, id desc limit ${limit}`;
  return rows.map((r) => ({ reason: r.reason, actor: r.actor, at: r.at,
    counts: { closed_trades: r.closed_trades, activities: r.activities, open_positions: r.open_positions, notes: r.notes, reports: r.reports } }));
}
