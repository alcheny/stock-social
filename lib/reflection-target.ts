// F-25: /me/record's reflection form posts the trade_key, never the vendor id. The stored trade_reflections rows stay keyed
// by the sell id, so the action resolves the key to my own close's sell id here: another user's key, a malformed one or
// none resolves to null (the action refuses it).
import { sql } from './db.ts';
import { TRADE_KEY_RE } from './trade-href.ts';

export async function ownSellIdForKey(userId: number | null | undefined, key: unknown): Promise<string | null> {
  if (!userId || typeof key !== 'string' || !TRADE_KEY_RE.test(key)) return null;
  const [r] = await sql`select sell_id from closed_trades where user_id = ${userId} and trade_key = ${key} limit 1`;
  return r ? (r.sell_id as string) : null;
}
