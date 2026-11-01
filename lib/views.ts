// F-15 (docs/features/F-15-measurement-foundation.md), first slice: aggregate daily view counts fed by the first-party
// beacon (app/view-beacon.tsx → app/api/views/route.ts). Stored rows are aggregates only: day, surface, the viewed
// trader's id (profile, trade and month surfaces), a referrer class, a `via` source class, a signed-in flag, a self-view
// flag and a count. The bot filter and the rate cap read the user agent and the client address in memory and drop them;
// nothing here stores or logs either. The counts are never an input to ordering, scores, streaks or badges and are never
// shown to traders: no page and no feed code reads these tables (lib/f15-isolation.test.ts). Owner readout:
// scripts/f15-readout.ts.
import { createHash, randomBytes } from 'node:crypto';
import { sql } from './db.ts';
import { clientIp } from './rate-limit.ts';
import { viewVia } from './referral.ts';
import { visibleUser } from './visible-users.ts';

export const VIEW_RETENTION_DAYS = 120; // proposed in the PR; the owner may change it (feature file, Open questions)
export { BEACON_BYTES, VISIBLE_MS, SURFACES, DROP_OTHER, REF_CLASSES, DROP_REASONS, surfaceOf, refClass, isRefClass } from './views-shared.ts';
export type { Surface, RefClass, DropReason, Target } from './views-shared.ts';
import { DROP_OTHER, isRefClass, type DropReason, type RefClass, type Surface, type Target } from './views-shared.ts';

// Declared automated clients, by generic words only (no product or platform names, POLICY T1, T5). A browser's user
// agent has the shape `Name/5.0 (platform...)`; anything else (a bare library or tool token) is not a browser.
const DECLARED = /bot\b|bot\/|crawl|spider|slurp|preview|fetch|scrap|externalhit|embed|unfurl|monitor|headless|validator|archiv|scan|probe|http[-_ ]?client/i;
const BROWSER_SHAPE = /^[A-Za-z]+\/5\.0 \(/;

// Why a same-origin beacon is not a human view, or null. Reads the user agent and fetch metadata in memory only.
export function botReason(h: { get(name: string): string | null }, automation: unknown): DropReason | null {
  const ua = h.get('user-agent') ?? '';
  if (!BROWSER_SHAPE.test(ua) || DECLARED.test(ua)) return 'declared_bot';
  // An older in-app view may send Origin without fetch metadata: only a request with neither is dropped (a cross-site
  // request was already refused by sameOrigin, lib/views-route.ts).
  if (h.get('sec-fetch-site') === null && h.get('origin') === null) return 'no_fetch_metadata';
  if (automation === true) return 'automation';
  return null;
}

// In-memory rate cap: at most RATE_MAX beacons per client per minute, per server instance. The key is a hash of the
// client address and user agent with a random salt that is replaced (and the map emptied) every hour; it is never
// stored or logged.
// ponytail: with no trusted client address (off the platform without TRUST_PROXY_HEADERS, lib/rate-limit.ts#clientIp)
// the cap is skipped (keying on the user agent alone would make readers with a common browser share one bucket and
// undercount them, business lead R1) — fix: set TRUST_PROXY_HEADERS behind that proxy, or a shared counter.
// ponytail: the cap is per instance, so N instances allow N × RATE_MAX a minute — fix: a shared counter keyed the same
// way (lib/rate-limit.ts) if scripted inflation shows up in the drop counts.
export const RATE_MAX = 60; // a reader swiping profiles in the pane can send one every 2 s (business lead D4)
const RATE_KEYS = 10_000;
type Bucket = { minute: number; n: number };
const rate = { salt: randomBytes(16), hour: -1, buckets: new Map<string, Bucket>() };
export function rateLimited(h: Headers, now = Date.now()): boolean {
  const hour = Math.floor(now / 3_600_000), minute = Math.floor(now / 60_000);
  if (hour !== rate.hour) { rate.hour = hour; rate.salt = randomBytes(16); rate.buckets.clear(); }
  const ip = clientIp(h);
  if (ip === null) return false;
  const key = createHash('sha256').update(rate.salt).update(ip).update('\n').update(h.get('user-agent') ?? '').digest('base64url').slice(0, 22);
  const b = rate.buckets.get(key);
  if (!b || b.minute !== minute) {
    if (!b && rate.buckets.size >= RATE_KEYS) rate.buckets.delete(rate.buckets.keys().next().value!);
    rate.buckets.set(key, { minute, n: 1 });
    return false;
  }
  b.n += 1;
  return b.n > RATE_MAX;
}

// The beacon's body: { path, ref, via, auto }. Anything else is dropped; null = not a beacon (nothing counted).
export type Beacon = { path: string; ref: RefClass; via: string; auto: boolean };
export function parseBeacon(text: string): Beacon | null {
  let b: unknown;
  try { b = JSON.parse(text); } catch { return null; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const o = b as Record<string, unknown>;
  if (typeof o.path !== 'string' || !isRefClass(o.ref)) return null;
  return { path: o.path, ref: o.ref, via: viewVia(o.via), auto: o.auto === true };
}

export type ViewKey = { surface: Surface; userId: number | null; ref: RefClass; via: string; signedIn: boolean; selfView: boolean; day?: Date };

// One idempotent upsert per beacon: concurrent beacons for one key add up on a single row.
export async function recordView(k: ViewKey): Promise<void> {
  const day = k.day ?? new Date();
  await sql`insert into view_rollup (day, surface, user_id, ref_class, via, signed_in, self_view, n)
    values (${day}::date, ${k.surface}, ${k.userId}, ${k.ref}, ${viewVia(k.via)}, ${k.signedIn}, ${k.selfView}, 1)
    on conflict (day, surface, user_id, ref_class, via, signed_in, self_view) do update set n = view_rollup.n + 1`;
}

export async function recordDrop(surface: Surface | typeof DROP_OTHER, reason: DropReason, day = new Date()): Promise<void> {
  await sql`insert into view_drops (day, surface, reason, n) values (${day}::date, ${surface}, ${reason}, 1)
    on conflict (day, surface, reason) do update set n = view_drops.n + 1`;
}

// A record surface's target → the visible trader's id (lib/visible-users.ts); a deleted or unknown handle, or a trade
// page whose closing sell the trader has no closed trade for, or a month with no close (pages that answer 404), → null
// (nothing counted). The sell id and the month are never stored.
export async function viewedUserId(t: Target): Promise<number | null> {
  if (!t.handle) return null;
  const [u] = t.surface === 'trade'
    ? await sql<{ id: number }[]>`select u.id from users u where u.handle = ${t.handle} and ${visibleUser('u')}
        and exists (select 1 from closed_trades c where c.user_id = u.id and c.sell_id = ${t.detail})`
    : t.surface === 'month'
    ? await sql<{ id: number }[]>`select u.id from users u where u.handle = ${t.handle} and ${visibleUser('u')}
        and exists (select 1 from closed_trades c where c.user_id = u.id and to_char(c.closed_at at time zone 'UTC', 'YYYY-MM') = ${t.detail})`
    : await sql<{ id: number }[]>`select u.id from users u where u.handle = ${t.handle} and ${visibleUser('u')}`;
  return u?.id ?? null;
}
