// F-15: the view beacon's route logic (app/api/views/route.ts calls it; route files may only export HTTP methods, so
// the writers are injectable here for tests). Same-origin only; a tiny body; the bot filter and the rate cap read the
// user agent and address in memory and drop them; a deleted or unknown target, an unknown path or a bad body counts
// nothing. Always 204 with no body and no-store (403 cross-site, 413 too large): the viewer's page never depends on it,
// and a database error is logged by class and code only (lib/privacy-log.ts), never surfaced.
import { sameOrigin } from './discovery/origin.ts';
import { logSafe } from './privacy-log.ts';
import { BEACON_BYTES, DROP_OTHER, type RateState, botReason, parseBeacon, rateLimited, recordDrop, recordView, surfaceOf, viewedUserId } from './views.ts';

export type BeaconDeps = {
  viewer: () => Promise<{ id: number } | null>;
  recordView: typeof recordView;
  recordDrop: typeof recordDrop;
  viewedUserId: typeof viewedUserId;
  limited?: (h: Headers) => RateState;
};
const RECORD = new Set(['profile', 'trade', 'month']);
const noStore = { 'cache-control': 'no-store' };
const answer = (status: number) => new Response(null, { status, headers: noStore });

export async function handleBeacon(req: Request, deps: BeaconDeps): Promise<Response> {
  const h = req.headers;
  // A request with neither Sec-Fetch-Site nor Origin is not a browser's: counted as a drop below. One that names another
  // site is refused outright.
  const bare = h.get('sec-fetch-site') === null && h.get('origin') === null;
  if (!bare && !sameOrigin(h)) return answer(403);
  if (Number(h.get('content-length') ?? 0) > BEACON_BYTES) return answer(413);
  try {
    const text = await readCapped(req, BEACON_BYTES); // a client that aborts mid-body throws here: still 204
    if (text === null) return answer(413);
    const beacon = parseBeacon(text);
    if (!beacon) return answer(204);
    const target = surfaceOf(beacon.path);
    // The rate cap comes first, so a flood (bot or not) costs one write per client per minute, not one per request.
    const limit = (deps.limited ?? rateLimited)(h);
    if (limit === 'over') return answer(204);
    const reason = limit === 'first-over' ? 'rate' : botReason(h, beacon.auto);
    if (reason) { await deps.recordDrop(target?.surface ?? DROP_OTHER, reason); return answer(204); }
    if (!target) return answer(204);
    const userId = RECORD.has(target.surface) ? await deps.viewedUserId(target) : null;
    if (RECORD.has(target.surface) && userId === null) return answer(204);
    const me = await deps.viewer();
    await deps.recordView({ surface: target.surface, userId, ref: beacon.ref, via: beacon.via, signedIn: !!me, selfView: !!me && userId !== null && me.id === userId });
  } catch (e) {
    console.error('view beacon failed', logSafe(e));
  }
  return answer(204);
}

async function readCapped(req: Request, max: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader(), parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { await reader.cancel(); return null; }
    parts.push(value);
  }
  return Buffer.concat(parts).toString('utf8');
}
