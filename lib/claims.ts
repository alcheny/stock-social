import { sql } from './db.ts';
import type { TransactionSql } from 'postgres';

// TR-6: a broker account belongs to one profile, ever. Shown on the owner's own profile only.
export const ACCOUNT_CLAIMED_TITLE = "We couldn't link that broker account.";
export const ACCOUNT_CLAIMED_BODY =
  "It's already connected to another Stock Social profile, and a broker account can only ever belong to one profile. This is what keeps every record verified. If you think this is a mistake, check that you connected the right brokerage login.";

export class AccountClaimedError extends Error {
  constructor() {
    super('broker account already claimed by another profile'); // never include ids or owners
    this.name = 'AccountClaimedError';
  }
}

// Ids in `requested` whose recorded owner is someone else.
export function partitionClaims(requested: string[], owners: Map<string, number>, userId: number): string[] {
  return requested.filter((id) => owners.has(id) && owners.get(id) !== userId);
}

const ROLLBACK = Symbol('rollback');

// Claim every account for userId, or none. Insert-then-check: the primary key picks one winner in a race.
// ponytail: SnapTrade ids are per brokerage connection; a fresh connection may yield a new id and dodge this.
// Deduping on account number / institution hash is future work, as is a deleted profile keeping its claim
// (needs the 1-year handle hold; `on delete cascade` would release it today).
export async function claimAccounts(userId: number, accountIds: string[]): Promise<{ ok: true } | { ok: false; conflicts: string[] }> {
  const ids = [...new Set(accountIds)];
  if (!ids.length) return { ok: true };
  let conflicts: string[] = [];
  try {
    await sql.begin(async (tx) => {
      const r = await claimIn(tx, userId, ids.map((id) => ({ id, isPaper: false })), { confirmed: true, now: new Date() });
      if (!r.ok) { conflicts = r.conflicts; throw ROLLBACK; }
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
    return { ok: false, conflicts };
  }
  return { ok: true };
}

export type ClaimOpts = { connectionId?: number; confirmed: boolean; now: Date };
// The claim inside a caller's transaction (F-1): provisional (confirmed_at null) at link time, confirmed at consent and
// on every completed sync. The paper flag is re-read each time; confirmed_at is never cleared. The caller rolls back
// on conflicts. Returns the ids owned by someone else.
export async function claimIn(tx: TransactionSql, userId: number, accounts: { id: string; isPaper: boolean }[], o: ClaimOpts): Promise<{ ok: true } | { ok: false; conflicts: string[] }> {
  const seen = new Map(accounts.map((a) => [a.id, a]));
  const ids = [...seen.keys()];
  if (!ids.length) return { ok: true };
  const rows = [...seen.values()].map((a) => ({
    account_id: a.id, user_id: userId, connection_id: o.connectionId ?? null, confirmed_at: o.confirmed ? o.now : null,
    is_paper: a.isPaper, paper_seen_at: a.isPaper ? o.now : null,
  }));
  await tx`insert into broker_accounts ${tx(rows)} on conflict (account_id) do update set
    confirmed_at = coalesce(broker_accounts.confirmed_at, excluded.confirmed_at),
    connection_id = coalesce(excluded.connection_id, broker_accounts.connection_id),
    is_paper = excluded.is_paper, paper_seen_at = case when excluded.is_paper then excluded.paper_seen_at else broker_accounts.paper_seen_at end
    where broker_accounts.user_id = excluded.user_id`;
  const owners = await tx`select account_id, user_id from broker_accounts where account_id in ${tx(ids)}`;
  const conflicts = partitionClaims(ids, new Map(owners.map((r) => [r.account_id as string, r.user_id as number])), userId);
  return conflicts.length ? { ok: false, conflicts } : { ok: true };
}
