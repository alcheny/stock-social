// F-1 PR-2b fix round 2 (business lead demand 1): the server decides whether the vendor's portal can be framed by the
// app, instead of the browser guessing from a blank frame. One HEAD request to the minted portal URL, sent from the
// server with no cookies or credentials, a short timeout, and the answer cached per vendor origin for an hour (so the
// one-time URL of at most one trader per hour is probed, with HEAD, which reads nothing). A probe that fails or times
// out means "embedded": the browser's own fallback (the blank-frame line and the new-page button) still exists.
// Fix round 4 (engineer re-sit, Lows 1 and 2):
// - Concurrent probes for one vendor origin are merged: one in flight per origin, every caller awaits the same promise.
//   The caller (lib/connections.ts#mintPortal) probes only after its transaction commits, so no wait here holds a pool
//   connection or the mint lock.
// - The probe is pinned to the exact origin the server minted (`portalOrigin`): a URL on any other origin is never
//   fetched. Redirects are not followed by fetch (`redirect: 'manual'`); a redirect is followed by hand only while it
//   stays on that same origin (at most MAX_HOPS), and one that leaves it (another host, loopback, another scheme or port)
//   is "unknown": embedded, with the client's fallback.
// Security hardening (2026-11-01): the answer lives in the database (portal_probes, sharedProbeStore), so every server
// instance shares it: behind N instances a vendor origin is probed once per hour between them. The route passes that
// store; the in-memory one is the default for unit tests.
import { framingAllowed } from './portal.ts';
import { sql } from './db.ts';
import type { PortalMode } from './connections.ts';

export const PROBE_TIMEOUT_MS = 1_500; // the whole probe, every hop included
export const PROBE_TTL_MS = 3_600_000; // a definite answer, per vendor origin
export const PROBE_FAIL_TTL_MS = 300_000; // a failed or redirected-away probe: "embedded" for 5 minutes, then asked again
export const PROBE_MAX_HOPS = 3; // same-origin redirects followed by hand

type ProbeResponse = Pick<Response, 'headers'> & { status?: number; body?: ReadableStream | null };
type Fetch = (url: string, init: RequestInit) => Promise<ProbeResponse>;
// Where answers are kept: per vendor origin, with the time they stop counting.
export type ProbeStore = { get: (origin: string, now: number) => Promise<PortalMode | null>; set: (origin: string, mode: PortalMode, until: number) => Promise<void> };
const memory = new Map<string, { mode: PortalMode; until: number }>();
export const memoryProbeStore: ProbeStore = {
  get: async (o, now) => { const c = memory.get(o); return c && c.until > now ? c.mode : null; },
  set: async (o, mode, until) => { memory.set(o, { mode, until }); },
};
// Shared by every instance. A store that fails (the database briefly away) reads as a miss: the probe runs again.
export const sharedProbeStore: ProbeStore = {
  get: async (o, now) => {
    const [r] = await sql`select mode from portal_probes where origin = ${o} and until > ${new Date(now)}`;
    return r ? (r.mode as PortalMode) : null;
  },
  set: async (o, mode, until) => {
    await sql`insert into portal_probes (origin, mode, until) values (${o}, ${mode}, ${new Date(until)})
      on conflict (origin) do update set mode = excluded.mode, until = excluded.until`;
  },
};
// Concurrent probes of one origin within this instance share one request.
// ponytail: first probes of one origin that start at the same moment on different instances each send one HEAD (at
// most one per instance per expiry) — a claim row in portal_probes taken before probing would merge them.
const inflight = new Map<string, Promise<PortalMode>>();
export const clearProbeCache = () => { memory.clear(); inflight.clear(); };

export async function probePortalMode(url: string, portalOrigin: string, appOrigin: string, opts: { fetch?: Fetch; now?: () => number; timeoutMs?: number; store?: ProbeStore } = {}): Promise<PortalMode> {
  const now = opts.now ?? Date.now;
  const store = opts.store ?? memoryProbeStore;
  const cached = await store.get(portalOrigin, now()).catch(() => null);
  if (cached) return cached;
  const running = inflight.get(portalOrigin);
  if (running) return running;
  const p = probe(url, portalOrigin, appOrigin, opts.fetch ?? fetch, opts.timeoutMs ?? PROBE_TIMEOUT_MS).then(async ({ mode, definite }) => {
    await store.set(portalOrigin, mode, now() + (definite ? PROBE_TTL_MS : PROBE_FAIL_TTL_MS)).catch(() => {});
    return mode;
  }).finally(() => { if (inflight.get(portalOrigin) === p) inflight.delete(portalOrigin); });
  inflight.set(portalOrigin, p);
  return p;
}

const originOf = (u: string, base?: string) => { try { return new URL(u, base); } catch { return null; } };
async function probe(url: string, portalOrigin: string, appOrigin: string, f: Fetch, timeoutMs: number): Promise<{ mode: PortalMode; definite: boolean }> {
  const unknown = { mode: 'embedded' as const, definite: false };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    let at = originOf(url);
    for (let hop = 0; at && at.origin === portalOrigin && hop <= PROBE_MAX_HOPS; hop++) {
      const r = await f(at.href, { method: 'HEAD', credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: abort.signal });
      await r.body?.cancel().catch(() => {});
      const status = r.status ?? 200;
      if (status >= 300 && status < 400) { at = originOf(r.headers.get('location') ?? '', at.href); continue; }
      const allowed = framingAllowed({ xfo: r.headers.get('x-frame-options'), csp: r.headers.get('content-security-policy') }, appOrigin, portalOrigin);
      return { mode: allowed ? 'embedded' : 'redirect', definite: true };
    }
    return unknown; // off the minted origin, a bad Location, or too many hops: never fetched, embedded
  } catch {
    return unknown; // unreachable, slow or refused: embedded, with the client's fallback
  } finally {
    clearTimeout(timer);
  }
}
