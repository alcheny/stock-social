import { NextResponse } from 'next/server';
import { sql } from '@/lib/db.ts';
import { records } from '@/lib/feed.ts';
import { recordStates } from '@/lib/connections.ts';

// F-2 PR-3b fix round 1 (business lead D2): a Similar trades row's pane, fetched when its sheet first opens
// (app/lazy-pane.tsx), so the profile no longer renders three other traders' records. Public like the profile (signed
// out works): the same closed trades the feed's pane reads, theses only when published, percentages only. An importing
// record is not whole, so it is not served.
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // Reviewer (tester Low): a handle outside the signup pattern (a NUL byte made Postgres throw, a 500) is a 404 before any query.
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const no = () => NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const [user] = await sql`select id from users where handle = ${handle} and deleted_at is null`;
  if (!user) return no();
  const [rows, states] = await Promise.all([records([user.id as number]), recordStates([user.id as number])]);
  const state = states.get(user.id as number)?.state ?? 'connected';
  if (state === 'importing') return no();
  const trades = rows.map((r) => ({ id: r.id, symbol: r.symbol, returnPct: r.returnPct, holdingDays: r.holdingDays, closedAt: r.closedAt.getTime(), thesis: r.thesis, verified: r.verified }));
  return NextResponse.json({ state, trades }, { headers: { 'cache-control': 'public, max-age=60' } });
}
