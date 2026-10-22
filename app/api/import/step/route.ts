import { NextResponse } from 'next/server';
import { sql } from '@/lib/db.ts';
import { applyClocks, importStep, latestConnection } from '@/lib/connections.ts';
import { currentUser } from '@/lib/session.ts';

// The client poll (S5 banner, PR-2b): one vendor page per call for the session user's own import, resumable from the
// stored cursor; the hourly tick advances the same row when no tab is open. Returns the state and the counts only.
export async function POST() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await applyClocks(new Date(), { userId: me.id });
  const c = await latestConnection(me.id);
  if (!c) return NextResponse.json({ state: 'none', imported: 0, closes: 0 });
  const r = c.state === 'importing' ? await importStep(c.id) : { state: c.state, imported: c.imported_count, progressed: false };
  const [{ n }] = await sql`select count(*)::int as n from closed_trades where user_id = ${me.id}`;
  return NextResponse.json({ state: r.state, imported: r.imported, closes: n as number });
}
