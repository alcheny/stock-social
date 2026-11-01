// Test helper for the F-9 thesis-safety tests (fix-user-text B): people and closed trades made from real activities, so
// rebuildTrades produces them. Every handle and id carries a random tag; tests remove only the users they made.
import { applySchemaForTests } from './privacy-test-schema.ts';

export const hasDb = !!process.env.DATABASE_URL;
let applied: Promise<void> | null = null;
export const ready = () => (applied ??= applySchemaForTests());

export async function people(n: number, prefix = 'f9') {
  const { createAttempt, createUserForAttempt } = await import('./auth/attempts.ts');
  const tag = `${prefix}${Math.random().toString(36).slice(2, 8)}`;
  const ids: number[] = [];
  for (let i = 0; i < n; i++) ids.push((await createUserForAttempt(await createAttempt({ method: 'dev', attested: true }), { handle: `${tag}${i}` })).id);
  return { tag, ids };
}

/** One buy and one sell per symbol for `user` (source 'demo'), then a rebuild. Returns the closes by sell id. */
export async function trades(user: number, tag: string, n: number, account = `${tag}-acct`) {
  const { insertActivities } = await import('./sync.ts');
  // Options merge (#62): the record is rebuilt through its one sanctioned entry point (rebuildTrades, then the option steps).
  const { rebuildRecord } = await import('./options-sync.ts');
  const { sql } = await import('./db.ts');
  const t0 = Date.now() - 10 * 86_400_000;
  const acts = [];
  for (let i = 0; i < n; i++) {
    acts.push({ externalId: `${tag}-b${i}`, accountId: account, symbol: `F${i}`, side: 'BUY' as const, units: 1, price: 10, fee: 0, executedAt: new Date(t0 + i * 3_600_000), verified: false, raw: {} });
    acts.push({ externalId: `${tag}-s${i}`, accountId: account, symbol: `F${i}`, side: 'SELL' as const, units: 1, price: 11, fee: 0, executedAt: new Date(t0 + 86_400_000 + i * 3_600_000), verified: false, raw: {} });
  }
  await insertActivities(user, 'demo', acts);
  await rebuildRecord(user);
  const rows = await sql`select id::text as id, sell_id from closed_trades where user_id = ${user} order by sell_id`;
  return rows.map((r) => ({ id: r.id as string, sell: r.sell_id as string }));
}

export async function removePeople(ids: number[]) {
  const { sql } = await import('./db.ts');
  await sql`delete from users where id = any(${ids})`;
}
