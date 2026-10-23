import { NextResponse } from 'next/server';
import { ownerPoll } from '@/lib/connections.ts';
import { currentUser } from '@/lib/session.ts';

// The client poll (S5 banner, PR-2b): one vendor page per call for each of the session user's importing connections,
// resumable from the stored cursors; the hourly tick advances the same rows when no tab is open. Returns the record's
// aggregate state (over all consented connections, fix round 3) and the counts only.
export async function POST() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await ownerPoll(me.id));
}
