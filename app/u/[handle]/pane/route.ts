import { NextResponse } from 'next/server';
import { sql } from '@/lib/db.ts';
import { records } from '@/lib/feed.ts';
import { recordStates } from '@/lib/connections.ts';
import { filerVisibleSql } from '@/lib/public-gate.ts';

// F-2 PR-3b fix round 1 (business lead D2): a Similar trades row's pane, fetched when its sheet first opens
// (app/lazy-pane.tsx), so the profile no longer renders three other traders' records. Public like the profile (signed
// out works): the same closed trades the feed's pane reads, theses only when published, percentages only. An importing
// record is not whole, so it is not served.
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // Reviewer (tester Low): a handle outside the signup pattern (a NUL byte made Postgres throw, a 500) is a 404 before any query.
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const no = () => NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const [user] = await sql`select id from users u where handle = ${handle} and deleted_at is null and ${filerVisibleSql('u')}`;
  if (!user) return no();
  // F-6: the trader's open positions (unrealized percent only), served for a connected or failed record only, as on the feed.
  const [rows, states, positions] = await Promise.all([records([user.id as number]), recordStates([user.id as number]),
    sql`select unrealized_pct, fetched_at from open_positions where user_id = ${user.id as number}`]);
  const state = states.get(user.id as number)?.state ?? 'connected';
  if (state === 'importing') return no();
  const trades = rows.map((r) => ({ id: r.id, symbol: r.symbol, returnPct: r.returnPct, holdingDays: r.holdingDays, closedAt: r.closedAt.getTime(), thesis: r.thesis, verified: r.verified }));
  const shown = state === 'connected' || state === 'failed' ? positions : [];
  const open = shown.map((p) => p.unrealized_pct as number);
  const openAsOf = shown.length ? Math.min(...shown.map((p) => (p.fetched_at as Date).getTime())) : null;
  return NextResponse.json({ state, trades, open, openAsOf }, { headers: { 'cache-control': 'public, max-age=60' } });
}
