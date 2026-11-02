// F-16 (docs/features/F-16-trust-and-safety-slice.md; plan docs/features/logs/F-16-F-17/plan.md §5.3): the owner's
// audited hide and unhide. Run only by the owner's CLI (scripts/hide.ts); no route, action or page calls it.
// - Only a whole profile (users.hidden_at) or one thesis (thesis_status 'held', thesis_hold_rule HIDDEN_RULE) can be
//   hidden. A single trade, card or month is refused: a hide can never select a trader's losses (TR-1).
// - Every change writes its trust_audit row in the same transaction; if the audit row fails, nothing changes.
// - Nothing is removed: a hide sets a time or a status, an unhide clears it. No thesis text reaches the audit row.
// - The latest audit row per thesis is the source of truth (plan v2 E6): a hidden thesis stays held through the
//   trader's edit, clear and rewrite (lib/thesis-save.ts calls thesisHiddenByOwner), and its unhide follows that row.
// - The actor is whatever the CLI was given (an arg or env), never a session.
// ponytail: an owner-run CLI with database access is the only admin identity — move to an admin page once real admin
// identity exists (then the actor comes from that identity).
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { HIDDEN_RULE } from './report-copy.ts';
import { MODERATION_VERSION, moderateDetail } from './moderation.ts';
import { HIDE_KINDS, HIDE_REASONS, UNHIDE_REASONS, isHideKind, isHideReason, isUnhideReason, type HideKind, type HideReason, type UnhideReason } from './trust-hide-reasons.ts';
export { HIDE_KINDS, HIDE_REASONS, UNHIDE_REASONS, isHideKind, isHideReason, isUnhideReason, type HideKind, type HideReason, type UnhideReason };

export type AuditRow = { kind: HideKind; user_id: number; sell_id: string | null; action: 'hide' | 'unhide'; reason: string; actor: string };
export type HideDeps = { audit: (tx: TransactionSql, row: AuditRow) => Promise<unknown> };
export const defaultHideDeps: HideDeps = {
  audit: (tx, r) => tx`insert into trust_audit (kind, user_id, sell_id, action, reason, actor)
    values (${r.kind}, ${r.user_id}, ${r.sell_id}, ${r.action}, ${r.reason}, ${r.actor})`,
};

export const REFUSED_KIND = 'Only a whole profile or a thesis can be hidden; a single trade is never hidden.';
export class RefusedKind extends Error {
  constructor() { super(REFUSED_KIND); this.name = 'RefusedKind'; }
}
export class RefusedInput extends Error {
  constructor(what: string) { super(`Refused: ${what}.`); this.name = 'RefusedInput'; }
}

// A fixed role word, never a person's name or address (no '@', no spaces): 'owner' until real admin identity exists.
export const ACTOR = /^[a-z][a-z0-9-]{0,31}$/;
const SELL = /^[\x21-\x7e]{1,200}$/;
function check(userId: number, actor: string, sellId?: string | null) {
  if (!Number.isInteger(userId) || userId <= 0) throw new RefusedInput('user id');
  if (!ACTOR.test(actor)) throw new RefusedInput('actor (a role word such as "owner")');
  if (sellId !== undefined && (typeof sellId !== 'string' || !SELL.test(sellId))) throw new RefusedInput('sell id');
}

/** Hide a profile: true when a visible profile became hidden. */
export async function hideProfile(userId: number, reason: HideReason, actor = 'owner', deps: HideDeps = defaultHideDeps): Promise<boolean> {
  check(userId, actor);
  if (!isHideReason(reason)) throw new RefusedInput('hide reason');
  return sql.begin(async (tx) => {
    const r = await tx`update users set hidden_at = now() where id = ${userId} and hidden_at is null and deleted_at is null returning 1`;
    if (!r.length) return false;
    await deps.audit(tx, { kind: 'profile', user_id: userId, sell_id: null, action: 'hide', reason, actor });
    return true;
  });
}

/** Unhide a profile: true when a hidden profile became visible again. */
export async function unhideProfile(userId: number, reason: UnhideReason, actor = 'owner', deps: HideDeps = defaultHideDeps): Promise<boolean> {
  check(userId, actor);
  if (!isUnhideReason(reason)) throw new RefusedInput('unhide reason');
  return sql.begin(async (tx) => {
    const r = await tx`update users set hidden_at = null where id = ${userId} and hidden_at is not null returning 1`;
    if (!r.length) return false;
    await deps.audit(tx, { kind: 'profile', user_id: userId, sell_id: null, action: 'unhide', reason, actor });
    return true;
  });
}

/** Hide a published thesis (on the trade, or kept aside by a rebuild): true when one was hidden. */
export async function hideThesis(userId: number, sellId: string, reason: HideReason, actor = 'owner', deps: HideDeps = defaultHideDeps): Promise<boolean> {
  check(userId, actor, sellId);
  if (!isHideReason(reason)) throw new RefusedInput('hide reason');
  return sql.begin(async (tx) => {
    const set = tx`thesis_status = 'held', thesis_hold_rule = ${HIDDEN_RULE}`;
    const a = await tx`update closed_trades set ${set} where user_id = ${userId} and sell_id = ${sellId} and thesis is not null and thesis_status = 'published' returning 1`;
    const b = await tx`update kept_theses set ${set} where user_id = ${userId} and sell_id = ${sellId} and thesis_status = 'published' returning 1`;
    if (!a.length && !b.length) return false;
    await deps.audit(tx, { kind: 'thesis', user_id: userId, sell_id: sellId, action: 'hide', reason, actor });
    return true;
  });
}

/**
 * Unhide a thesis (plan v2 E6): allowed while the latest audit row for it is a hide. Whatever row exists then is
 * moderated again and published only when its current text passes (the trader may have rewritten it meanwhile); with none, the audit row alone ends the hide,
 * so the trader's next note is moderated as usual. Reports count afresh from now (thesis_reports_from).
 */
export async function unhideThesis(userId: number, sellId: string, reason: UnhideReason, actor = 'owner', deps: HideDeps = defaultHideDeps): Promise<boolean> {
  check(userId, actor, sellId);
  if (!isUnhideReason(reason)) throw new RefusedInput('unhide reason');
  return sql.begin(async (tx) => {
    if (!(await thesisHiddenByOwner(tx, userId, sellId))) return false;
    // Fix round 1 (review item 1): an edit made while hidden was stored held/hidden without its own moderation result,
    // so each row's current text is moderated here (lib/moderation.ts#moderateDetail, as lib/thesis-save.ts does) and
    // only a clean note is published; a match stays held with its rule and no review mark, like a fresh save.
    for (const table of ['closed_trades', 'kept_theses'] as const) {
      const rows = await tx`select thesis from ${tx(table)} where user_id = ${userId} and sell_id = ${sellId}
        and thesis is not null and thesis_hold_rule = ${HIDDEN_RULE} for update`;
      for (const { thesis } of rows) {
        const { status, rule } = moderateDetail(thesis);
        const set = status === 'published'
          ? tx`thesis_status = 'published', thesis_hold_rule = null, thesis_reviewed_at = now()`
          : tx`thesis_status = 'held', thesis_hold_rule = ${rule}, thesis_reviewed_at = null`;
        await tx`update ${tx(table)} set ${set}, thesis_reports_from = now(), thesis_checked_version = ${MODERATION_VERSION}
          where user_id = ${userId} and sell_id = ${sellId} and thesis = ${thesis} and thesis_hold_rule = ${HIDDEN_RULE}`;
      }
    }
    await deps.audit(tx, { kind: 'thesis', user_id: userId, sell_id: sellId, action: 'unhide', reason, actor });
    return true;
  });
}

/** True while the latest audit row for this thesis is a hide (lib/thesis-save.ts keeps a re-written note held). */
export async function thesisHiddenByOwner(db: TransactionSql | typeof sql, userId: number, sellId: string): Promise<boolean> {
  const [r] = await db`select action from trust_audit where user_id = ${userId} and kind = 'thesis' and sell_id = ${sellId}
    order by at desc, id desc limit 1`;
  return r?.action === 'hide';
}

/** The typed entry for any kind (scripts/hide.ts): anything but a profile or a thesis throws RefusedKind. */
export async function hideItem(kind: string, userId: number, sellId: string | null, reason: HideReason, actor = 'owner', deps: HideDeps = defaultHideDeps): Promise<boolean> {
  if (!isHideKind(kind)) throw new RefusedKind();
  if (kind === 'profile') return hideProfile(userId, reason, actor, deps);
  if (!sellId) throw new RefusedInput('sell id');
  return hideThesis(userId, sellId, reason, actor, deps);
}

export type AuditEntry = AuditRow & { at: Date };
/** The audit trail for one trader, oldest first (the CLI's `history`). Codes and times only. */
export async function hideHistory(userId: number): Promise<AuditEntry[]> {
  const rows = await sql`select kind, user_id, sell_id, action, reason, actor, at from trust_audit where user_id = ${userId} order by at, id`;
  return rows.map((r) => ({ kind: r.kind, user_id: r.user_id, sell_id: r.sell_id, action: r.action, reason: r.reason, actor: r.actor, at: r.at }));
}
