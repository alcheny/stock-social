// CHORES-3 (C3-34): what GET /api/health answers. Public: `ok` or `degraded` only. Behind the cron bearer: booleans,
// ISO times and hours only (legal veto: no ids, handles, user counts, figures or error text).
// The threshold is the sync round (lib/sync.ts ROUND_MS: every connected trader is due once a round, and the 5-minute
// cron stamps the shard heartbeat on every run), never a fixed number of minutes, so a cadence change moves it too.
import { sql } from './db.ts';
import { logSafe } from './privacy-log.ts';
import { ROUND_MS, syncable } from './sync.ts';
import { cronAuthorized } from './cron-auth.ts';

export const THRESHOLD_MS = ROUND_MS;
const HOUR_MS = 3_600_000;

export type HealthReading = { dbOk: boolean; last: Date | null; stalest: Date | null };
export type HealthDetails = { status: 'ok' | 'degraded'; db: boolean; lastRunAt: string | null; lastRunAgeHours: number | null; stalestSyncAgeHours: number | null; thresholdHours: number };

const hours = (ms: number) => Math.round(Math.max(0, ms) / HOUR_MS * 100) / 100;

// Degraded when the database cannot be read, no run was ever recorded, or the newest run is older than a round. The
// stalest trader's sync is reported, never a cause: backoff and quarantine legitimately hold a trader for up to 24 h.
// ponytail: `last` is the newest heartbeat across all shards, so one dead shard among live ones still reads ok — the
// sync route's coverage line reports it (`missingShards`); a per-shard check would need the schedule's shard count.
export function healthStatus(r: HealthReading, now: number): HealthDetails {
  const ok = r.dbOk && !!r.last && now - r.last.getTime() <= THRESHOLD_MS;
  return {
    status: ok ? 'ok' : 'degraded',
    db: r.dbOk,
    lastRunAt: r.dbOk && r.last ? r.last.toISOString() : null,
    lastRunAgeHours: r.dbOk && r.last ? hours(now - r.last.getTime()) : null,
    stalestSyncAgeHours: r.dbOk && r.stalest ? hours(now - r.stalest.getTime()) : null,
    thresholdHours: hours(THRESHOLD_MS),
  };
}

// One statement. The public answer needs the newest heartbeat only (sync_shards is one row per shard); the stalest
// trader is read only for a caller with the cron bearer, so an anonymous caller can't make the database scan the
// syncable set. Stalest is over the traders the sync claims (lib/sync.ts#syncable): frozen or disconnected records,
// whose last sync grows for ever by design, never count; records never synced yet are the coverage line's `neverSynced`.
export async function readHealth(details = true): Promise<HealthReading> {
  const [r] = details
    ? await sql`select (select max(heartbeat_at) from sync_shards) as last, (select min(u.last_synced_at) from users u where ${syncable()}) as stalest`
    : await sql`select (select max(heartbeat_at) from sync_shards) as last, null::timestamptz as stalest`;
  return { dbOk: true, last: (r.last as Date | null) ?? null, stalest: (r.stalest as Date | null) ?? null };
}

// Test hook: the reading (a test injects a throwing one).
export const healthDeps: { read: (details: boolean) => Promise<HealthReading>; now: () => number } = { read: readHealth, now: () => Date.now() };

export async function health(details = true): Promise<HealthDetails> {
  let reading: HealthReading = { dbOk: false, last: null, stalest: null };
  try { reading = await healthDeps.read(details); } catch (e) { console.error('health query failed', logSafe(e)); }
  return healthStatus(reading, healthDeps.now());
}

// The route's answer (app/api/health/route.ts): the public body unless the cron bearer is presented; 503 when degraded,
// so a monitor that reads only status codes sees it. Never cached. A wrong bearer is not logged here.
export async function healthResponse(req: Request): Promise<Response> {
  const details = cronAuthorized(req);
  const d = await health(details);
  const body = details ? d : { status: d.status };
  return Response.json(body, { status: d.status === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } });
}
