import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db.ts';
import { syncAll, syncDeadline, syncRouteEnd, syncTick, type TickReport } from '@/lib/sync.ts';
import { purgeExpiredLinks } from '@/lib/auth/links.ts';
import { tick } from '@/lib/connections.ts';
import { deleteProfile, type DeletableUser } from '@/lib/delete.ts';
import { purgeDiscovery, type PurgeReport } from '@/lib/discovery/purge.ts';
import { logSafe } from '@/lib/privacy-log.ts';
import { purgePrivacy, type PrivacyPurgeReport } from '@/lib/privacy-purge.ts';
import { writeDisplayLog, type DisplayLogReport } from '@/lib/display-log.ts';
import { gateReport } from '@/lib/launch-gate.ts';

const PRIVACY_SLOT_MS = 5_000;
const PRIVACY_STAGE_MS = 10_000;
const PRIVACY_STAGE_MARGIN_MS = 30_000;

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
  try { purged = await purgeDiscovery(); } catch (e) { console.error('discovery purge failed', logSafe(e)); }
  // Only traders with a connected (consented) connection and no import in progress, each claimed by one caller per
  // round (lib/sync.ts#syncTick), so overlapping cron calls split the traders instead of syncing each one twice.
  // ponytail: one caller is sequential, ~5k traders/hour; more concurrent calls add throughput, then a queue (DESIGN §2.7)
  // Privacy work (committee D13, D14, D3, D19; orchestrator review 2): the privacy purges and today's display-log rows
  // get a small fixed slot before the sync (PRIVACY_SLOT_MS each, so a busy tick can never starve them), then use any
  // time left after it (up to PRIVACY_STAGE_MS each, never within PRIVACY_STAGE_MARGIN_MS of the route's end). Both
  // resume where they stopped. Each call in its own try/catch; the log line carries counts, milliseconds and the gate
  // state only.
  const left = () => syncRouteEnd(startedAt) - PRIVACY_STAGE_MARGIN_MS - Date.now();
  let privacy: PrivacyPurgeReport | null = null;
  let displayLog: DisplayLogReport | null = null;
  const ms = { privacy: 0, displayLog: 0 };
  const privacyStages = async (boxMs: number) => {
    const t0 = Date.now();
    try { if (boxMs > 0) privacy = await purgePrivacy({ boxMs }); } catch (e) { console.error('privacy purge failed', logSafe(e)); }
    const t1 = Date.now();
    try { if (boxMs > 0 && left() > 0) displayLog = await writeDisplayLog({ boxMs }); } catch (e) { console.error('display log failed', logSafe(e)); }
    ms.privacy += t1 - t0; ms.displayLog += Date.now() - t1;
  };
  await privacyStages(PRIVACY_SLOT_MS);
  let end: TickReport | null = null;
  const { ok, skipped, failed } = await syncTick({ deadline, routeEnd: syncRouteEnd(startedAt), report: (r) => { end = r; } });
  await privacyStages(Math.min(PRIVACY_STAGE_MS, left()));
  const launch = gateReport();
  console.log('privacy tick', JSON.stringify({ privacy, displayLog, launch, ms })); // counts, milliseconds and the gate state only
  return NextResponse.json({ ok, skipped, failed, unclaimed: end!.unclaimed, stoppedAtDeadline: end!.stoppedAtDeadline, purgedLinks, connections, deletions, purged, privacy, displayLog, launch, ms });
}
