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
import { filerVisibleSql } from './public-gate.ts';

export const VIEW_RETENTION_DAYS = 120; // proposed in the PR; the owner may change it (feature file, Open questions)
export { BEACON_BYTES, VISIBLE_MS, SURFACES, DROP_OTHER, REF_CLASSES, DROP_REASONS, surfaceOf, refClass, isRefClass } from './views-shared.ts';
export type { Surface, RefClass, DropReason, Target } from './views-shared.ts';
import { DROP_OTHER, isRefClass, type DropReason, type RefClass, type Surface, type Target } from './views-shared.ts';

// Declared automated clients, by generic words only (no product or platform names, POLICY T1, T5). A browser's user
// agent has the shape `Name/5.0 (platform...)`; anything else (a bare library or tool token) is not a browser.
const DECLARED = /bot\b|bot\/|crawl|spider|preview|fetch|scrap|externalhit|embed|unfurl|monitor|headless|validator|archiv|scan|probe|http[-_ ]?client/i;
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
// undercount them, business lead R1); since F-31 such a day leaves an untrusted mark (markCapDay) and the readout flags
// its week "address cap: not live", so the skip is visible, not fixed — fix: set TRUST_PROXY_HEADERS behind that proxy,
// or a shared counter.
// ponytail: the cap is per instance, so N instances allow N × RATE_MAX a minute — fix: a shared counter keyed the same
// way (lib/rate-limit.ts) if scripted inflation shows up in the drop counts.
// Per address (shared by a household or an office behind one address): a few readers swiping at once.
export const RATE_ADDR_MAX = 180;
export const RATE_MAX = 60; // a reader swiping profiles in the pane can send one every 2 s (business lead D4)
const RATE_KEYS = 10_000;
type Bucket = { minute: number; n: number };
const rate = { salt: randomBytes(16), hour: -1, buckets: new Map<string, Bucket>() };
// 'ok' under the cap; 'first-over' for the first beacon past it in a minute (written once as a 'rate' drop); 'over' for
// the rest of that minute (answered, not written).
// ponytail: only the first capped beacon per client and minute is counted as a drop, so the rate row undercounts a
// flood — fix: count capped beacons in memory and write the total once a minute.
export type RateState = 'ok' | 'first-over' | 'over';
export function rateLimited(h: Headers, now = Date.now()): RateState {
  const hour = Math.floor(now / 3_600_000), minute = Math.floor(now / 60_000);
  if (hour !== rate.hour) { rate.hour = hour; rate.salt = randomBytes(16); rate.buckets.clear(); }
  const ip = clientIp(h);
  if (ip === null) return 'ok';
  // Two buckets: per address (so rotating the user agent can't multiply the cap, orchestrator review 1) and per address
  // and agent. The address is already a /56 for IPv6 (lib/rate-limit.ts#clientIp).
  const hash = (...parts: string[]) => createHash('sha256').update(rate.salt).update(parts.join('\n')).digest('base64url').slice(0, 22);
  const states = [bump(`a:${hash(ip)}`, minute, RATE_ADDR_MAX), bump(`u:${hash(ip, h.get('user-agent') ?? '')}`, minute, RATE_MAX)];
  return states.includes('first-over') ? 'first-over' : states.includes('over') ? 'over' : 'ok';
}
function bump(key: string, minute: number, max: number): RateState {
  const b = rate.buckets.get(key);
  if (!b || b.minute !== minute) {
    if (!b && rate.buckets.size >= RATE_KEYS) rate.buckets.delete(rate.buckets.keys().next().value!);
    rate.buckets.set(key, { minute, n: 1 });
    return 'ok';
  }
  b.n += 1;
  return b.n <= max ? 'ok' : b.n === max + 1 ? 'first-over' : 'over';
}

// F-31 (docs/features/F-31-readout-limits-and-partial-rows.md, plan §4): whether a beacon's address could be checked by
// the rate cap above, stored only as a per-UTC-day presence mark in view_cap_days (no address, agent, user or count).
// The owner's readout reads a week as "live" only with a trusted mark and no untrusted one. Same rule as the cap itself
// (clientIp), so the mark can't disagree with it.
// ponytail: a mark says only that some beacon that day had (or lacked) a trusted address, not how many — fix: a per-day
// count if the owner needs the untrusted share.
// ponytail: an untrusted mark whose write failed and was never retried (the instance ended inside the 5-minute backoff)
// leaves that day reading trusted only, so its week can read live — fix: write the mark in the view upsert's statement.
export function addressTrusted(h: Headers, env: Record<string, string | undefined> = process.env): boolean {
  return clientIp(h, env) !== null;
}
export async function insertCapDay(day: string, trusted: boolean): Promise<void> {
  await sql`insert into view_cap_days (day, trusted) values (${day}::date, ${trusted}) on conflict do nothing`;
}
export const CAP_RETRY_MS = 300_000; // a failing database is tried at most once per 5 minutes per kind
// A write still unsettled after this counts as failed (postgres.js has no query timeout: a half-open connection would
// otherwise hold the memo for good, orchestrator review of #98).
export const CAP_TIMEOUT_MS = 1_000;
function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((_, reject) => { t = setTimeout(() => reject(new Error('view cap mark timed out')), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}
type CapMemo = { p: Promise<void> | null; failedAt: number | null };
const capMemo = { day: '', entries: new Map<boolean, CapMemo>() };
// At most one write per kind per UTC day per instance: concurrent beacons share the in-flight attempt (memoized before
// any await), a success is kept for the day, and a failure or a write unsettled after CAP_TIMEOUT_MS is retried no sooner than CAP_RETRY_MS later (rethrown to
// the caller, which logs it by class and code).
export function markCapDay(trusted: boolean, now = new Date(), write: (day: string, trusted: boolean) => Promise<void> = insertCapDay, timeoutMs = CAP_TIMEOUT_MS): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  if (capMemo.day !== day) { capMemo.day = day; capMemo.entries.clear(); }
  let e = capMemo.entries.get(trusted);
  if (!e) capMemo.entries.set(trusted, (e = { p: null, failedAt: null }));
  if (e.p) return e.p;
  if (e.failedAt !== null && now.getTime() - e.failedAt < CAP_RETRY_MS) return Promise.resolve();
  const entry = e;
  const p: Promise<void> = withTimeout(Promise.resolve().then(() => write(day, trusted)), timeoutMs).catch((err: unknown) => {
    if (entry.p === p) { entry.p = null; entry.failedAt = now.getTime(); }
    throw err;
  });
  entry.p = p;
  return p;
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
  // The record pages' own rule (app/u/[handle]/page.tsx, lib/recap-load.ts, lib/trade-share-load.ts): a visible user,
  // a public filer only while shown (not hidden or removed, F-7 legal C13, C19) and only with a closed trade.
  const visible = sql`${visibleUser('u')} and ${filerVisibleSql('u')}
    and (u.public_filer_id is null or exists (select 1 from closed_trades f where f.user_id = u.id))`;
  const [u] = t.surface === 'trade'
    ? await sql<{ id: number }[]>`select u.id from users u where u.handle = ${t.handle} and ${visible}
        and exists (select 1 from closed_trades c where c.user_id = u.id and c.sell_id = ${t.detail})`
    : t.surface === 'month'
    ? await sql<{ id: number }[]>`select u.id from users u where u.handle = ${t.handle} and ${visible}
        and exists (select 1 from closed_trades c where c.user_id = u.id
          and c.closed_at >= ${t.detail + '-01'}::timestamp at time zone 'UTC' and c.closed_at < (${t.detail + '-01'}::timestamp + interval '1 month') at time zone 'UTC')`
    : await sql<{ id: number }[]>`select u.id from users u where u.handle = ${t.handle} and ${visible}`;
  return u?.id ?? null;
}
