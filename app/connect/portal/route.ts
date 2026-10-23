import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { boundAttempt, CONNECT_COOKIE, mintPortal, RateLimitedError } from '@/lib/connections.ts';
import { portalOrigin } from '@/lib/portal.ts';
import { probePortalMode } from '@/lib/portal-probe.ts';
import { currentUser, origin } from '@/lib/session.ts';

// S3 (PR-2b): the embedded portal's URL, minted here for the session user or the attempt bound to this browser by the
// signed cookie, exactly as /connect/start does for the redirect flow. Nothing in the request (query, body, referrer)
// is read as a URL: the modal only ever frames what this returns, so a portal session someone else opened can never be
// shown inside the app (the lured-portal case carried from PR-2a). The origin the browser checks messages against is
// the minted URL's own; anything that is not an https vendor URL is refused and the browser falls back to the redirect.
// Fix round 2: the server probes the minted URL's framing headers (lib/portal-probe.ts) and answers `mode`: 'embedded'
// (the dialog frames it) or 'redirect' (the browser navigates to it; recorded as a redirect open). Mints are
// rate-limited per trader (429) and serialized under the per-user lock (lib/connections.ts#mintPortal).
// Fix round 4: the probe runs after the mint's transaction commits (no lock or pool connection held while the vendor is
// slow), one in flight per vendor origin, pinned to the origin minted here, following no redirect off it. Its cache
// and in-flight map are per instance; the mint limit and the registration lock are in the database.
const noStore = { 'cache-control': 'no-store' };
export async function POST() {
  const me = await currentUser();
  const attemptId = me ? me.signup_attempt_id : await boundAttempt((await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret());
  if (attemptId === null) return NextResponse.json({ error: 'unbound' }, { status: 401, headers: noStore });
  const app = await origin();
  const allowLoopback = !!process.env.SNAPTRADE_BASE_URL;
  try {
    const { url, mode } = await mintPortal({ userId: me?.id ?? null, attemptId }, `${app}/connect/done`, async (u) => {
      const o = portalOrigin(u, { allowLoopback });
      return o ? probePortalMode(u, o, app) : 'embedded';
    });
    const portal = portalOrigin(url, { allowLoopback });
    if (!portal) return NextResponse.json({ error: 'portal' }, { status: 502, headers: noStore });
    return NextResponse.json({ url, origin: portal, mode }, { headers: noStore });
  } catch (e) {
    if (e instanceof RateLimitedError) return NextResponse.json({ error: 'rate' }, { status: 429, headers: { ...noStore, 'retry-after': '600' } });
    throw e;
  }
}
