import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db.ts';
import { syncAll, syncDeadline, syncRouteEnd } from '@/lib/sync.ts';
import { coverage, runShard, type Coverage } from '@/lib/sync-shard.ts';
import { parseCall } from '@/lib/sync-limits.ts';
import { purgeExpiredLinks } from '@/lib/auth/links.ts';
import { tick } from '@/lib/connections.ts';
import { deleteProfile, type DeletableUser } from '@/lib/delete.ts';
import { purgeDiscovery, type PurgeReport } from '@/lib/discovery/purge.ts';
import { reconcileIfDue } from '@/lib/billing.ts';
import { logSafe } from '@/lib/privacy-log.ts';
import { logUnauthorized } from '@/lib/cron-auth.ts';
import { purgePrivacy, type PrivacyPurgeReport } from '@/lib/privacy-purge.ts';
import { writeDisplayLog, type DisplayLogReport } from '@/lib/display-log.ts';
import { gateReport } from '@/lib/launch-gate.ts';
import { publicTradersOn } from '@/lib/public-gate.ts';
import { importPublicFilings, type ImportReport } from '@/lib/public-import.ts';
import { catchUpMatcher, MATCHER_CATCHUP_MS, type CatchUp } from '@/lib/matcher-rebuild.ts';

const PRIVACY_SLOT_MS = 5_000;
const PRIVACY_STAGE_MS = 10_000;
const PRIVACY_STAGE_MARGIN_MS = 30_000;

// Cron: POST /api/sync with `Authorization: Bearer $CRON_SECRET`, every 5 minutes and never at :30 (request #7 as amended;
// rounds run :30 to :30, lib/sync.ts). Sharded (docs/SYNC.md): `?shard=i&of=N` syncs only traders with `id % N = i`;
// no parameters is shard 0 of 1 (every trader, plus the housekeeping and the coverage report); on a sharded schedule
// `?task=housekeeping&of=N` runs the housekeeping and the coverage report alone.
// F-1 PR-3 fix round 4 (business lead 3): the function's limit, above the 30 s vendor bound with room for a sync claimed
// at the cut-off. A literal, since the framework reads it statically; lib/sync.ts#SYNC_ROUTE_MAX_S mirrors it (tested).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const deadline = syncDeadline(startedAt);
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(got, want)) {
    logUnauthorized('sync'); // CHORES-3 (C3-34): one rate-limited line, no bearer value, header or IP
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const call = parseCall(req.nextUrl.searchParams);
  if ('error' in call) return NextResponse.json({ error: call.error }, { status: 400 });
  const { shard } = call;

  // Housekeeping runs once per cron mark: in the unsharded call (before its sync, as before) or, on an N-shard schedule,
  // in its own `task=housekeeping` call, so no shard's sync window is spent on it (orchestrator review 3). It never
  // waits on a shard lease (committee O4), and each step is safe to overlap with another call.
  // ponytail: housekeeping's own vendor calls (import steps, deletions) are outside the shards' request budgets — the
  // vendor ceiling is N × SYNC_VENDOR_RPS plus them (docs/SYNC.md); metering them needs lib/connections.ts and
  // lib/delete.ts to take a budget.
  const zero = call.mode !== 'shard';
  const syncs = call.mode !== 'housekeeping';
  let housekeeping: Record<string, unknown> = {};
  if (zero) {
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
    try { purged = await purgeDiscovery(); } catch (e) { console.error('discovery purge failed', logSafe(e)); }
    // F-3: the billing reconciliation, once a day (lib/billing.ts#reconcileIfDue). Never a branch for the sync below.
    try { await reconcileIfDue(); } catch (e) { console.error('billing reconcile failed', logSafe(e)); }
    housekeeping = { purgedLinks, connections, deletions, purged, housekeepingMs: Math.round(performance.now() - t0) };
    // ---- chores cycle 5 (C5-43 part c): sitemap ----
    // The stored sitemap is rebuilt here, at most once per REBUILD_MS fleet-wide; no request aggregates closed_trades
    // (lib/sitemaps.ts). Never a branch for the sync below. Counts only.
    try {
      const { rebuildSitemapIfDue } = await import('@/lib/sitemaps.ts');
      housekeeping.sitemap = await rebuildSitemapIfDue();
    } catch (e) { console.error('sitemap rebuild failed', logSafe(e)); }
    // ---- end chores cycle 5 (C5-43 part c) ----
  }
  // Privacy work (committee D13, D14, D3, D19; orchestrator review 2): the privacy purges and today's display-log rows
  // get a small fixed slot before the sync (PRIVACY_SLOT_MS each, so a busy tick can never starve them), then use any
  // time left after it (up to PRIVACY_STAGE_MS each, never within PRIVACY_STAGE_MARGIN_MS of the route's end). Both
  // resume where they stopped. Each call in its own try/catch; the log line carries counts, milliseconds and the gate
  // state only. Sharded sync: they are housekeeping, so they run once per cron mark, with the housekeeping.
  const left = () => syncRouteEnd(startedAt) - PRIVACY_STAGE_MARGIN_MS - Date.now();
  let privacy: PrivacyPurgeReport | null = null;
  let displayLog: DisplayLogReport | null = null;
  const ms = { privacy: 0, displayLog: 0 };
  const privacyStages = async (boxMs: number) => {
    if (!zero) return;
    const t0 = Date.now();
    try { if (boxMs > 0) privacy = await purgePrivacy({ boxMs }); } catch (e) { console.error('privacy purge failed', logSafe(e)); }
    const t1 = Date.now();
    try { if (boxMs > 0 && left() > 0) displayLog = await writeDisplayLog({ boxMs }); } catch (e) { console.error('display log failed', logSafe(e)); }
    ms.privacy += t1 - t0; ms.displayLog += Date.now() - t1;
  };
  await privacyStages(PRIVACY_SLOT_MS);
  // Only traders with a connected (consented) connection and no import in progress, each claimed once per round
  // (lib/sync.ts), in this shard, by bounded concurrent workers under the shard's lease (lib/sync-shard.ts).
  const run = syncs ? await runShard({ shard, deadline, routeEnd: syncRouteEnd(startedAt) }) : null;
  // ---- chores cycle 5 (C5-43 part b): matcher catch-up ----
  // Every shard call (never the housekeeping-only call) rebuilds some of its own records not yet rebuilt for the current
  // MATCHER_VERSION, after its sync and within MATCHER_CATCHUP_MS of the time left, so a matcher change reaches every
  // record (frozen ones too) within ticks instead of waiting for later deploys. One primary-key read once the version is
  // done. Never a branch: whatever it returns or throws, the response below is the same.
  let matcher: CatchUp | null = null;
  try { if (syncs && left() > 0) matcher = await catchUpMatcher({ shard, budgetMs: Math.min(MATCHER_CATCHUP_MS, left()) }); } catch (e) { console.error('matcher catch-up failed', logSafe(e)); }
  // ---- end chores cycle 5 (C5-43 part b) ----
  // F-7: public filings, one bounded stage after the broker sync, once per cron mark (≤ 20 s, its own try/catch), switch on only.
  let publicImport: ImportReport | null = null;
  try { if (zero && publicTradersOn() && left() > 0) publicImport = await importPublicFilings({ boxMs: Math.min(20_000, left()) }); } catch (e) { console.error('public import failed', logSafe(e)); }
  await privacyStages(Math.min(PRIVACY_STAGE_MS, left()));
  let cover: Coverage | null = null;
  let launch: ReturnType<typeof gateReport> | null = null;
  if (zero) {
    try { cover = await coverage(shard.of); } catch (e) { console.error('sync coverage failed', logSafe(e)); }
    launch = gateReport();
    console.log('privacy tick', JSON.stringify({ privacy, displayLog, launch, ms })); // counts, milliseconds and the gate state only
  }
  // `ok`, `skipped`, `failed` (internal ids), `unclaimed`, `stoppedAtDeadline` keep the unsharded call's answer; `run` is
  // the run's counters (as logged).
  const { failedIds = [], ...counters } = run ?? {};
  return NextResponse.json({
    ok: run?.done ?? 0, skipped: run?.skipped ?? 0, failed: failedIds, unclaimed: run?.remaining ?? null, stoppedAtDeadline: run?.stoppedAtDeadline ?? false,
    run: run ? counters : null, matcher, coverage: cover, ...housekeeping, ...(zero ? { privacy, displayLog, publicImport, launch, ms } : {}),
  });
}

// The host's cron sends GET with the same `Authorization: Bearer $CRON_SECRET` header (business council, PR #45): the
// same handler, the same constant-time check, the same shard parameters. A GET route handler is dynamic (never cached).
// ponytail: the cron schedule itself (vercel.json `crons`) is a deploy setting for the owner, not in this repo — add the
// entries listed in docs/SYNC.md → Cron setup.
export async function GET(req: NextRequest) {
  return POST(req);
}
