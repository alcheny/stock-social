import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { TransactionSql } from 'postgres';
import { sql } from './db.ts';
import { sessionSecret } from './auth/sessions.ts';

// F-1 PR-2b fix round 2 (engineer, Low): a minimum interval per key. The import poll uses it (one step per trader per
// second): each step reaches the vendor, and the banner itself polls every 2 s, so only a script or many open tabs ever
// meet it. Security hardening (2026-11-01): one row per key in rate_marks, so every instance shares it; the upsert only
// moves the mark when the interval has passed, so parallel calls let exactly one through.
export async function intervalAllowed(key: string, ms: number, now = new Date()): Promise<boolean> {
  const rows = await sql`insert into rate_marks (key, at) values (${key}, ${now})
    on conflict (key) do update set at = excluded.at where rate_marks.at <= excluded.at - ${ms} * interval '1 millisecond'
    returning 1`;
  if (Math.random() < 0.01) await pruneRateMarks().catch(() => {}); // housekeeping only; never fails the caller
  return rows.length === 1;
}
// Marks older than a day, in bounded batches, by the database clock.
export async function pruneRateMarks(): Promise<void> {
  await sql`delete from rate_marks where ctid in (select ctid from rate_marks where at < now() - interval '1 day' limit 500)`;
}

// Security hardening (2026-11-01): the shared limit, in the database, so every instance counts the same window.
// Fixed windows aligned to the epoch; one upsert per call, so parallel calls cannot slip past the limit.

export const windowStart = (now: Date, windowSec: number) => new Date(Math.floor(now.getTime() / (windowSec * 1000)) * windowSec * 1000);

// True while the call is within `limit` for this key's current window. The window length is part of the stored key,
// so one key may carry a 15-minute and a daily limit side by side.
// `db` lets a caller count inside its own transaction (no second pool connection while it holds a lock).
export async function hit(key: string, limit: number, windowSec: number, now = new Date(), db: TransactionSql | typeof sql = sql): Promise<boolean> {
  const [r] = await db`insert into rate_limits (key, window_start, n) values (${`${key}/${windowSec}`}, ${windowStart(now, windowSec)}, 1)
    on conflict (key, window_start) do update set n = rate_limits.n + 1 returning n`;
  if (db === sql && Math.random() < 0.01) await pruneRateLimits().catch(() => {}); // housekeeping only; never fails the caller
  return (r.n as number) <= limit;
}

// Windows (a day at most) that started more than two days ago, in bounded batches, by the database clock.
export async function pruneRateLimits(): Promise<void> {
  await sql`delete from rate_limits where ctid in (select ctid from rate_limits where window_start < now() - interval '2 days' limit 500)`;
}

// A key never carries personal data (POLICY P3): the scope, then a keyed hash of scope and value (unlinkable across scopes).
export const limitKey = (scope: string, value: string) => `${scope}:${createHmac('sha256', sessionSecret()).update(`${scope}\0${value}`).digest('hex').slice(0, 32)}`;

// The address a per-address limit counts: lower-case, the +tag dropped, so tag variants share one limit. The link still
// goes to the address as typed.
export function canonicalEmail(email: string): string {
  const e = email.toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 0) return e;
  const local = e.slice(0, at), plus = local.indexOf('+');
  return `${plus < 0 ? local : local.slice(0, plus)}${e.slice(at)}`;
}

// The client's address, only where a trusted proxy sets it; elsewhere the headers are the client's own word, so null and
// per-address limits are skipped (no shared bucket one client could exhaust for everyone). On Vercel (which overwrites
// both headers): x-real-ip, else the first X-Forwarded-For entry. With TRUST_PROXY_HEADERS=1 (a proxy that appends to
// X-Forwarded-For): the rightmost entry, the one that proxy added; the entries left of it are whatever the client sent.
// An IPv4-mapped IPv6 address counts as its IPv4 address; other IPv6 per /56, a common delegation to one subscriber
// (a /64 would let one subscriber rotate through 256 buckets).
export function clientIp(h: Headers, env: Record<string, string | undefined> = process.env): string | null {
  const xff = (h.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const picked = env.VERCEL === '1' ? (h.get('x-real-ip') ?? xff[0]) : env.TRUST_PROXY_HEADERS === '1' ? xff.at(-1) : undefined;
  const raw = (picked ?? '').trim().replace(/^\[(.*)\]$/, '$1');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(raw);
  if (mapped) return isIP(mapped[1]) === 4 ? mapped[1] : null;
  const v = isIP(raw);
  if (v === 4) return raw;
  if (v !== 6) return null;
  const g = expand6(raw);
  return `${g.slice(0, 3).join(':')}:${(parseInt(g[3], 16) & 0xff00).toString(16)}::/56`;
}

// A global cap reached: one line for the operator per scope per window, per process (no key, address or count).
const capWarned = new Map<string, number>();
export function capReached(scope: string, windowSec: number, now = new Date()): void {
  const w = windowStart(now, windowSec).getTime();
  if (capWarned.get(scope) === w) return;
  capWarned.set(scope, w);
  console.warn('rate limit cap reached', JSON.stringify({ scope })); // a fixed scope name, never a key
}

function expand6(ip: string): string[] {
  const [head, tail] = ip.includes('::') ? ip.split('::') : [ip, null];
  const a = head ? head.split(':') : [];
  const b = tail ? tail.split(':') : [];
  const groups = tail === null ? a : [...a, ...Array(8 - a.length - b.length).fill('0'), ...b];
  return groups.map((g) => (g.includes('.') ? g : g.replace(/^0+(?=.)/, '').toLowerCase()));
}
