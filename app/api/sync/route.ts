import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db.ts';
import { syncAll, syncDeadline, syncRouteEnd, syncTick, type TickReport } from '@/lib/sync.ts';
import { purgeExpiredLinks } from '@/lib/auth/links.ts';
import { tick } from '@/lib/connections.ts';
import { deleteProfile, type DeletableUser } from '@/lib/delete.ts';
import { purgeDiscovery, type PurgeReport } from '@/lib/discovery/purge.ts';

// Cron: POST /api/sync with `Authorization: Bearer $CRON_SECRET`, every 5 minutes and never at :30 (request #7 as amended;
// rounds run :30 to :30, lib/sync.ts).
// F-1 PR-3 fix round 4 (business lead 3): the function's limit, above the 30 s vendor bound with room for a sync claimed
// at the cut-off. A literal, since the framework reads it statically; lib/sync.ts#SYNC_ROUTE_MAX_S mirrors it (tested).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const deadline = syncDeadline(startedAt);
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const purgedLinks = await purgeExpiredLinks(); // expired sign-in links go with their address (COMPLIANCE §3)
  // F-1: clocks (pending → expired, stale importing → failed), every importing row advanced, cleanups retried.
  const connections = await tick(undefined, undefined, deadline);
  // Deletions a failed vendor call left marked (lib/delete.ts) are finished here.
  const pendingDeletes = await sql<DeletableUser[]>`select id, handle, snaptrade_user_id, snaptrade_secret_enc from users where deleted_at is not null`;
  const deletions = await syncAll(pendingDeletes, (u) => deleteProfile(u));
  // F-2 PR-2 (plan demand D): ended exclusions, ≤ 30 s under its own lock. Never a branch: whatever it returns or
  // throws, the traders below are claimed exactly as before.
  let purged: PurgeReport | null = null;
  try { purged = await purgeDiscovery(); } catch (e) { console.error('discovery purge failed', e instanceof Error ? e.message : e); }
  // Only traders with a connected (consented) connection and no import in progress, each claimed by one caller per
  // round (lib/sync.ts#syncTick), so overlapping cron calls split the traders instead of syncing each one twice.
  // ponytail: one caller is sequential, ~5k traders/hour; more concurrent calls add throughput, then a queue (DESIGN §2.7)
  let end: TickReport | null = null;
  const { ok, skipped, failed } = await syncTick({ deadline, routeEnd: syncRouteEnd(startedAt), report: (r) => { end = r; } });
  return NextResponse.json({ ok, skipped, failed, unclaimed: end!.unclaimed, stoppedAtDeadline: end!.stoppedAtDeadline, purgedLinks, connections, deletions, purged });
}
