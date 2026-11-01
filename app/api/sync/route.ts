import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db.ts';
import { syncAll, syncDeadline, syncRouteEnd } from '@/lib/sync.ts';
import { coverage, runShard, type Coverage } from '@/lib/sync-shard.ts';
import { parseShard } from '@/lib/sync-limits.ts';
import { purgeExpiredLinks } from '@/lib/auth/links.ts';
import { tick } from '@/lib/connections.ts';
import { deleteProfile, type DeletableUser } from '@/lib/delete.ts';
import { purgeDiscovery, type PurgeReport } from '@/lib/discovery/purge.ts';

// Cron: POST /api/sync with `Authorization: Bearer $CRON_SECRET`, every 5 minutes and never at :30 (request #7 as amended;
// rounds run :30 to :30, lib/sync.ts). Sharded (docs/SYNC.md): `?shard=i&of=N` syncs only traders with `id % N = i`;
// no parameters is shard 0 of 1 (every trader). Shard 0 also runs the housekeeping and the coverage report.
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

  const shard = parseShard(req.nextUrl.searchParams);
  if ('error' in shard) return NextResponse.json({ error: shard.error }, { status: 400 });

  // Housekeeping runs once per cron mark, on shard 0, before and regardless of the shard lease (committee O4): a busy
  // shard 0 still finishes pending deletions. Each step is safe to overlap with another call.
  let housekeeping: Record<string, unknown> = {};
  if (shard.shard === 0) {
    const t0 = performance.now();
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
    housekeeping = { purgedLinks, connections, deletions, purged, housekeepingMs: Math.round(performance.now() - t0) };
  }

  // Only traders with a connected (consented) connection and no import in progress, each claimed once per round
  // (lib/sync.ts), in this shard, by bounded concurrent workers under the shard's lease (lib/sync-shard.ts).
  const run = await runShard({ shard, deadline, routeEnd: syncRouteEnd(startedAt) });
  let cover: Coverage | null = null;
  if (shard.shard === 0) {
    try { cover = await coverage(shard.of); } catch (e) { console.error('sync coverage failed', e instanceof Error ? e.name : 'error'); }
  }
  // `ok`, `skipped`, `failed` (internal ids), `unclaimed`, `stoppedAtDeadline` keep the unsharded call's answer; `run` is
  // the run's counters (as logged).
  const { failedIds, ...counters } = run;
  return NextResponse.json({
    ok: run.done, skipped: run.skipped, failed: failedIds, unclaimed: run.remaining, stoppedAtDeadline: run.stoppedAtDeadline,
    run: counters, coverage: cover, ...housekeeping,
  });
}
