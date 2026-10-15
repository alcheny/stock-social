import { sql } from './db.ts';

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
      await tx`insert into broker_accounts ${tx(ids.map((account_id) => ({ account_id, user_id: userId })))} on conflict (account_id) do nothing`;
      const rows = await tx`select account_id, user_id from broker_accounts where account_id in ${tx(ids)}`;
      conflicts = partitionClaims(ids, new Map(rows.map((r) => [r.account_id as string, r.user_id as number])), userId);
      if (conflicts.length) throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
    return { ok: false, conflicts };
  }
  return { ok: true };
}
