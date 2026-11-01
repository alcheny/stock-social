// Profile deletion (POLICY P6): the vendor user goes first; if that fails nothing here is deleted. Then the users row
// cascades (identities, sessions, activities, closed_trades, claims, events), the sign-in links that carried the address
// go in the same transaction, and the handle is reserved for a year
// with no personal data. The two-step screen (S9) is PR-2a; this is the action behind it.
import type { ReservedSql } from 'postgres';
import { sql } from './db.ts';
import { deleteUser } from './broker.ts';

export type DeletableUser = { id: number; handle: string; snaptrade_user_id: string | null; snaptrade_secret_enc: string | null };
export type DeleteDeps = { deleteVendorUser: (u: { snaptradeUserId: string; secretEnc: string }) => Promise<void> };

export const HANDLE_RESERVED_DAYS = 365;

// A vendor user already gone (404) counts as deleted; any other vendor error keeps the row, marked, for the hourly retry.
export const defaultDeleteDeps: DeleteDeps = {
  deleteVendorUser: async (u) => { try { await deleteUser(u); } catch (e) { const x = e as { status?: number; response?: { status?: number } }; if ((x?.status ?? x?.response?.status) !== 404) throw e; } },
};

// deleted_at marks a deletion in progress before the vendor call: if the vendor call fails the row stays, marked, and
// the next call finishes it (PR-2a's S9 hides marked rows and retries from the hourly tick).
export async function deleteProfile(u: DeletableUser, deps: DeleteDeps = defaultDeleteDeps): Promise<void> {
  // F-2 PR-2: the first step, with the mark: follows and exclusions made by this account or naming it go before the
  // vendor call, so a failed vendor call still leaves none (the cascade covers any written meanwhile).
  await sql.begin((tx) => [
    tx`update users set deleted_at = coalesce(deleted_at, now()) where id = ${u.id}`,
    tx`delete from follows where viewer_id = ${u.id} or trader_id = ${u.id}`,
    tx`delete from viewer_exclusions where viewer_id = ${u.id} or trader_id = ${u.id}`,
    // F-2 PR-4: likes and rejected trades, made by this account or naming it.
    tx`delete from trade_likes where viewer_id = ${u.id} or trader_id = ${u.id}`,
    tx`delete from trade_exclusions where viewer_id = ${u.id} or trader_id = ${u.id}`,
    // F-2 PR-5: the activity log, made by this account or naming it.
    tx`delete from discovery_events where viewer_id = ${u.id}`,
    tx`delete from discovery_events where target_user_id = ${u.id}`,
  ]);
  if (u.snaptrade_user_id && u.snaptrade_secret_enc) await deps.deleteVendorUser({ snaptradeUserId: u.snaptrade_user_id, secretEnc: u.snaptrade_secret_enc });
  await sql.begin(async (tx) => {
    // Sign-in links are keyed by attempt, not user (COMPLIANCE §3): every link on the user's attempts and every link sent
    // to an address on the user's identities goes before the users row (which would null the attempts' user_id).
    await tx`delete from login_links where attempt_id in (select id from signup_attempts where user_id = ${u.id})
      or email in (select email from identities where user_id = ${u.id} and email is not null)`;
    await tx`insert into handle_reservations (handle, until) values (${u.handle}, now() + ${HANDLE_RESERVED_DAYS} * interval '1 day')
      on conflict (handle) do update set until = excluded.until`;
    await tx`delete from users where id = ${u.id}`;
  });
}

// F-2 PR-5 (owner 2026-11-01: preference data is stored until removed; only orphans are purged): a like or hidden trade
// whose close is gone is marked; one still gone ORPHAN_DAYS later is deleted; a close that came back (a rebuild, a lifted
// quarantine) clears its mark. Run by lib/discovery/purge.ts under its lock and time box, in batches.
export const ORPHAN_DAYS = 30;
type Conn = typeof sql | ReservedSql;
export async function purgeOrphans(conn: Conn, o: { batch: number; end: number; clock: () => number }): Promise<{ deleted: number; done: boolean }> {
  let deleted = 0;
  const steps = [
    () => conn`update trade_likes l set orphan_at = null where orphan_at is not null and exists (select 1 from closed_trades c where c.trade_key = l.trade_key and c.user_id = l.trader_id)`,
    () => conn`update trade_exclusions l set orphan_at = null where orphan_at is not null and exists (select 1 from closed_trades c where c.trade_key = l.trade_key and c.user_id = l.trader_id)`,
  ];
  for (const s of steps) await s();
  const loops = [
    () => conn`update trade_likes set orphan_at = now() where (viewer_id, trade_key) in (select viewer_id, trade_key from trade_likes l where orphan_at is null
      and not exists (select 1 from closed_trades c where c.trade_key = l.trade_key and c.user_id = l.trader_id) limit ${o.batch})`,
    () => conn`update trade_exclusions set orphan_at = now() where (viewer_id, trade_key) in (select viewer_id, trade_key from trade_exclusions l where orphan_at is null
      and not exists (select 1 from closed_trades c where c.trade_key = l.trade_key and c.user_id = l.trader_id) limit ${o.batch})`,
    () => conn`delete from trade_likes where (viewer_id, trade_key) in (select viewer_id, trade_key from trade_likes l where orphan_at < now() - ${ORPHAN_DAYS} * interval '1 day'
      and not exists (select 1 from closed_trades c where c.trade_key = l.trade_key and c.user_id = l.trader_id) limit ${o.batch})`,
    () => conn`delete from trade_exclusions where (viewer_id, trade_key) in (select viewer_id, trade_key from trade_exclusions l where orphan_at < now() - ${ORPHAN_DAYS} * interval '1 day'
      and not exists (select 1 from closed_trades c where c.trade_key = l.trade_key and c.user_id = l.trader_id) limit ${o.batch})`,
  ];
  for (const [i, step] of loops.entries()) {
    for (;;) {
      if (o.clock() >= o.end) return { deleted, done: false };
      const r = await step();
      if (i >= 2) deleted += r.count;
      if (r.count < o.batch) break;
    }
  }
  return { deleted, done: true };
}
