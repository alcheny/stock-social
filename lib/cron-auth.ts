// CHORES-3 (C3-34, approval council cycle 3): the cron bearer check for the health endpoint's details, and the one
// rate-limited log line the cron routes write when a call carries a missing or wrong bearer.
// Legal conditions (cycle-3 ballots, C3-34): the line never holds the presented bearer value or any part of it (a
// mistyped real secret is still a secret, POLICY S2), no header and no IP address (P3). It goes through logSafe: the
// error it reduces is built here from nothing in the request, so all logSafe can print is "CronUnauthorized status 401".
import { createHash, timingSafeEqual } from 'node:crypto';
import { logSafe } from './privacy-log.ts';

// The same rule as app/api/sync/route.ts and app/api/billing/reconcile/route.ts (which keep their own inline copy:
// lib/sync-route.test.ts pins it in the route's source). Both sides are hashed first, so the compare is constant time
// and always of equal length (the secret's length is not revealed either). False when CRON_SECRET is unset.
const digest = (s: string) => createHash('sha256').update(s).digest();
export function cronAuthorized(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  return timingSafeEqual(digest(req.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`));
}

export class CronUnauthorized extends Error {
  readonly status = 401;
  constructor() { super('cron unauthorized'); }
}
// logSafe prints the error's constructor name; the production build minifies class names (QA D1: it read "s"), so the
// name is fixed here.
Object.defineProperty(CronUnauthorized, 'name', { value: 'CronUnauthorized' });

export type CronRoute = 'sync' | 'billing-reconcile';
export const CRON_LOG_WINDOW_MS = 60_000;
// ponytail: the limit is per route per warm server instance (a cold start resets it, so the fleet-wide rate grows with
// the instance count; the map is bounded by the two routes) — a shared limit would need a database row per window.
const last = new Map<CronRoute, { at: number; suppressed: number }>();

// At most one line per route per window; the next line says how many 401s went unlogged since the last one.
// Returns whether it logged (a test hook).
export function logUnauthorized(route: CronRoute, now = Date.now()): boolean {
  const seen = last.get(route);
  if (seen && now - seen.at < CRON_LOG_WINDOW_MS) { seen.suppressed++; return false; }
  const suppressed = seen?.suppressed ?? 0;
  last.set(route, { at: now, suppressed: 0 });
  const denied = new CronUnauthorized();
  console.warn('cron unauthorized', logSafe(denied), JSON.stringify({ route, suppressed }));
  return true;
}
