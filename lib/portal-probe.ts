// F-1 PR-2b fix round 2 (business lead demand 1): the server decides whether the vendor's portal can be framed by the
// app, instead of the browser guessing from a blank frame. One HEAD request to the minted portal URL, sent from the
// server with no cookies or credentials, a short timeout, and the answer cached per vendor origin for an hour (so the
// one-time URL of at most one trader per hour is probed, with HEAD, which reads nothing). A probe that fails or times
// out means "embedded": the browser's own fallback (the blank-frame line and the new-page button) still exists.
import { framingAllowed } from './portal.ts';
import type { PortalMode } from './connections.ts';

export const PROBE_TIMEOUT_MS = 1_500;
export const PROBE_TTL_MS = 3_600_000; // a definite answer, per vendor origin
export const PROBE_FAIL_TTL_MS = 300_000; // a failed probe: "embedded" for 5 minutes, then asked again

type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, 'headers'>>;
const cache = new Map<string, { mode: PortalMode; until: number }>();
export const clearProbeCache = () => cache.clear();

export async function probePortalMode(url: string, portalOrigin: string, appOrigin: string, opts: { fetch?: Fetch; now?: () => number; timeoutMs?: number } = {}): Promise<PortalMode> {
  const now = opts.now ?? Date.now;
  const hit = cache.get(portalOrigin);
  if (hit && hit.until > now()) return hit.mode;
  let mode: PortalMode = 'embedded', ttl = PROBE_FAIL_TTL_MS;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), opts.timeoutMs ?? PROBE_TIMEOUT_MS);
  try {
    const r = await (opts.fetch ?? fetch)(url, { method: 'HEAD', credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: abort.signal });
    mode = framingAllowed({ xfo: r.headers.get('x-frame-options'), csp: r.headers.get('content-security-policy') }, appOrigin, portalOrigin) ? 'embedded' : 'redirect';
    ttl = PROBE_TTL_MS;
  } catch { /* unreachable, slow or refused: embedded, with the client's fallback */ } finally { clearTimeout(timer); }
  cache.set(portalOrigin, { mode, until: now() + ttl });
  return mode;
}
