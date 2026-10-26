// F-4: the record card's one read, shared by the link unfurl and the Share button's picture, so they cannot drift.
// Percent-only columns; the trust state comes from the same rules as the profile (record state, demo profile, every
// close from the broker).
import { sql } from '@/lib/db.ts';
import { publicRecord } from '@/lib/connections.ts';
import { isDemoUser } from '@/lib/demo.ts';
import { recordCard, type CardKind, type CardModel } from '@/lib/record-card.ts';

export async function loadRecordCard(handle: string, kind: CardKind, link: string | null = null): Promise<CardModel | null> {
  if (typeof handle !== 'string' || !handle) return null;
  const [user] = await sql`select id, display_name from users where handle = ${handle} and deleted_at is null`;
  if (!user) return null; // no card for an unknown handle or a profile being deleted (the profile itself is 404 too)
  const rows = await sql`select symbol, return_pct, holding_days, opened_at, closed_at, verified from closed_trades where user_id = ${user.id}`;
  const [{ state }, demo] = await Promise.all([publicRecord(Number(user.id)), isDemoUser(Number(user.id))]);
  return recordCard({
    kind, handle, name: user.display_name as string | null, state, demo, link, now: new Date(),
    verified: rows.length > 0 && rows.every((t) => t.verified),
    trades: rows.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: Number(t.return_pct), holdingDays: Number(t.holding_days) })),
  });
}
