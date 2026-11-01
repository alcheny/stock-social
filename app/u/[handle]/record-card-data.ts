// F-4: the record card's one read, shared by the link unfurl, the Share button's picture and the profile's alt text,
// so they cannot drift. Percent-only columns; the trust state comes from the same rules as the profile (record state,
// demo profile, every close from the broker).
import { sql } from '@/lib/db.ts';
import { publicRecord } from '@/lib/connections.ts';
import { isDemoUser } from '@/lib/demo.ts';
import { cardLink, recordCard, type CardKind, type CardModel } from '@/lib/record-card.ts';
import { optionHeadline, paneView } from '@/lib/options-load.ts'; // OPTIONS (AC 24): the flag and the line only

// ponytail: a profile view reads its rows twice (load() in page.tsx, then this for the metadata and the share prompt) —
// let the page pass its rows in once the profile and the card share one loader.
export async function loadRecordCard(handle: string, kind: CardKind): Promise<CardModel | null> {
  if (typeof handle !== 'string' || !handle) return null;
  const [user] = await sql`select id, display_name from users where handle = ${handle} and deleted_at is null`;
  if (!user) return null; // no card for an unknown handle or a profile being deleted (the profile itself is 404 too)
  const rows = await sql`select symbol, return_pct, holding_days, opened_at, closed_at, verified from closed_trades where user_id = ${user.id}`;
  // F-6: the unrealized percent of each open position only (no symbol, no account): the card prints no symbols.
  // recordCard decides whether they show (a broker record, no import running), as the profile lists them.
  const [{ state }, demo, open, options] = await Promise.all([publicRecord(Number(user.id)), isDemoUser(Number(user.id)),
    sql`select unrealized_pct from open_positions where user_id = ${user.id}`, optionHeadline([Number(user.id)])]);
  const opt = paneView(options.get(Number(user.id))!);
  return recordCard({
    kind, handle, name: user.display_name as string | null, state, demo, now: new Date(),
    // Committee round 1, demand 8: the configured origin, never the request's Host header (the picture is cacheable).
    link: kind === 'unfurl' ? null : cardLink(process.env, handle),
    verified: rows.length > 0 && rows.every((t) => t.verified),
    open: open.map((p) => Number(p.unrealized_pct)).filter(Number.isFinite),
    options: { shareLabel: opt.label, line: opt.line }, // OPTIONS
    trades: rows.map((t) => ({ symbol: t.symbol, openedAt: t.opened_at, closedAt: t.closed_at, returnPct: Number(t.return_pct), holdingDays: Number(t.holding_days) })),
  });
}
