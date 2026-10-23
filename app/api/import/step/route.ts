import { NextResponse } from 'next/server';
import { importedRows, ownerPoll } from '@/lib/connections.ts';
import { minInterval } from '@/lib/rate-limit.ts';
import { currentUser } from '@/lib/session.ts';

// The client poll (S5 banner, app/u/[handle]/import-banner.tsx): one vendor page per call for each of the session
// user's importing connections, resumable from the stored cursors; the hourly tick advances the same rows when no tab is open. Returns the record's
// aggregate state (over all consented connections, fix round 3) and the counts only.
// Fix round 2 (engineer, Lows and Info): every answer is no-store; at most one step per trader per second (429 with
// Retry-After; the banner treats it as "nothing new"); 401 when signed out, which stops the banner's polling.
const STEP_MIN_MS = 1_000;
const allow = minInterval(STEP_MIN_MS);
const noStore = { 'cache-control': 'no-store' };
export async function POST() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  if (!allow(String(me.id))) return NextResponse.json({ error: 'rate' }, { status: 429, headers: { ...noStore, 'retry-after': '1' } });
  const r = await ownerPoll(me.id);
  return NextResponse.json({ ...r, read: await importedRows(me.id) }, { headers: noStore }); // read: distinct rows stored, for the S5 banner (PR-2b)
}
