import { createHmac, hkdfSync } from 'node:crypto';
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
// A deleted profile keeping its claim is future work (needs the 1-year handle hold; `on delete cascade` releases it today).
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

// ---- A stable account identity behind the claim (known limit removed 2026-11-01) ----
// Vendor account ids are per brokerage connection: deleting a connection and linking the same brokerage account again
// gives a new id, which the vendor-id claim alone cannot tie to the old one. The vendor's account record also carries
// `institution_account_id`, "a stable and unique account identifier provided by the institution … can be used to check
// if a user has connected the same brokerage account across multiple connections" (optional, nullable; SDK types).
// The identity is a keyed hash of the normalized institution name and that identifier: the raw identifier (it can be
// an account number) is never stored, logged or put in a URL. The name is part of it because the identifier is unique
// within an institution, not across them (committee 2026-11-01, Q1: a false refusal of an honest trader is worse).
// The key is derived from APP_SECRET_KEY with HKDF under its own label; rotating APP_SECRET_KEY orphans these hashes,
// as it already orphans the stored vendor secrets (lib/broker.ts).
// ponytail: lib/broker.ts#listAccounts (protected) does not pass `institution_account_id` through yet, so no account
// has an identity and the dodge stays open until the owner adds it (`institutionAccountId: a.institution_account_id ??
// null` on VendorAccount); every caller here already forwards it. Profiles that shared an account through a second
// connection before that are not detectable (no identity was ever stored for them).
const IDENTITY_LABEL = 'stock-social/broker-account-identity/v1';
// Advisory lock class for an identity's claim check (USER_LOCK in lib/sync.ts is 1, ATTEMPT_LOCK in lib/connections.ts 2).
export const IDENTITY_LOCK = 3;
let identityKey: Buffer | null = null;
const keyForIdentity = () => {
  if (!identityKey) {
    const secret = process.env.APP_SECRET_KEY;
    if (!secret) throw new Error('APP_SECRET_KEY is not set');
    identityKey = Buffer.from(hkdfSync('sha256', secret, '', IDENTITY_LABEL, 32));
  }
  return identityKey;
};
// Tests: forget the derived key (after changing APP_SECRET_KEY).
export const resetIdentityKey = () => { identityKey = null; };

export const normalizeInstitution = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export type IdentitySource = { institution?: string | null; institutionAccountId?: string | null };
// The account's stable identity, or null when the vendor gives no institution account id (then only the vendor id is
// claimed, as before).
export function accountIdentity(a: IdentitySource): string | null {
  const raw = typeof a.institutionAccountId === 'string' ? a.institutionAccountId.trim() : '';
  if (!raw) return null;
  return createHmac('sha256', keyForIdentity()).update(`${normalizeInstitution(a.institution ?? '')}\u0000${raw}`).digest('base64url');
}

// What a claim needs per account: the vendor id, the paper flag and, when known, the identity (given, or derived from
// the vendor fields of a VendorAccount).
export type ClaimAccount = { id: string; isPaper: boolean; identity?: string | null } & IdentitySource;
const identityOf = (a: ClaimAccount) => (a.identity !== undefined ? a.identity : accountIdentity(a));

// The claims (vendor id, owner, confirmed) that carry any of `identities`, in the caller's transaction or not.
export async function identityOwners(db: TransactionSql | typeof sql, identities: string[]): Promise<{ identity: string; user_id: number; confirmed: boolean }[]> {
  if (!identities.length) return [];
  const rows = await db`select identity, user_id, confirmed_at is not null as confirmed from broker_accounts where identity in ${db(identities)}`;
  return rows.map((r) => ({ identity: r.identity as string, user_id: r.user_id as number, confirmed: r.confirmed as boolean }));
}

export type ClaimOpts = { connectionId?: number; confirmed: boolean; now: Date };
// The claim inside a caller's transaction (F-1): provisional (confirmed_at null) at link time, confirmed at consent and
// on every completed sync. The paper flag is re-read each time; confirmed_at is never cleared. The caller rolls back
// on conflicts. Returns the ids owned by someone else.
// The identity is claimed the same way in the same transaction: an account whose identity another profile owns is a
// conflict even under a vendor id never seen before (the dodge), and a profile linking its own account again under a
// new vendor id is not.
export async function claimIn(tx: TransactionSql, userId: number, accounts: ClaimAccount[], o: ClaimOpts): Promise<{ ok: true } | { ok: false; conflicts: string[] }> {
  const seen = new Map(accounts.map((a) => [a.id, a]));
  const ids = [...seen.keys()];
  if (!ids.length) return { ok: true };
  const identity = new Map([...seen.values()].map((a) => [a.id, identityOf(a)]));
  const identities = [...new Set([...identity.values()].filter((k): k is string => !!k))].sort();
  // The identity lives on the claim row, so it is released exactly when the claim is (a provisional claim's cleanup,
  // the users cascade). Its check is not a key, so each identity is locked first (sorted: two claims never wait on
  // each other): of two profiles racing on one account under two vendor ids, the second sees the first's row.
  for (const k of identities) await tx`select pg_advisory_xact_lock(${IDENTITY_LOCK}, hashtext(${k}))`;
  // Sorted by account id: two claims over overlapping accounts lock their rows in one order (no deadlock).
  const rows = [...seen.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)).map((a) => ({
    account_id: a.id, user_id: userId, connection_id: o.connectionId ?? null, confirmed_at: o.confirmed ? o.now : null,
    is_paper: a.isPaper, paper_seen_at: a.isPaper ? o.now : null, identity: identity.get(a.id) ?? null,
  }));
  await tx`insert into broker_accounts ${tx(rows)} on conflict (account_id) do update set
    confirmed_at = coalesce(broker_accounts.confirmed_at, excluded.confirmed_at),
    connection_id = coalesce(excluded.connection_id, broker_accounts.connection_id),
    is_paper = excluded.is_paper, paper_seen_at = case when excluded.is_paper then excluded.paper_seen_at else broker_accounts.paper_seen_at end,
    identity = coalesce(excluded.identity, broker_accounts.identity)
    where broker_accounts.user_id = excluded.user_id`;
  const owners = await tx`select account_id, user_id from broker_accounts where account_id in ${tx(ids)}`;
  const conflicts = partitionClaims(ids, new Map(owners.map((r) => [r.account_id as string, r.user_id as number])), userId);
  const taken = new Set((await identityOwners(tx, identities)).filter((r) => r.user_id !== userId).map((r) => r.identity));
  for (const id of ids) if (taken.has(identity.get(id) ?? '') && !conflicts.includes(id)) conflicts.push(id);
  return conflicts.length ? { ok: false, conflicts } : { ok: true };
}
