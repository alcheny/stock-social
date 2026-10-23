import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { boundAttempt, CONNECT_COOKIE, RateLimitedError, refuseUnbound, startConnection } from '@/lib/connections.ts';
import { PORTAL } from '@/lib/copy.ts';
import { currentUser, origin } from '@/lib/session.ts';

// S2 → the vendor's read-only portal by redirect: the S3 modal's fallback (a portal error, the persistent "Open in a new
// page instead" link, S7a's "Continue in a new page", in-app browsers, no script). The embedded flow is POST /connect/portal.
// Signed in, the connection hangs off the user; brokerage-first (signed out), off the attested attempt this browser was bound to at S1 by the signed
// `connect_attempt` cookie. Committee fix (High): an id in the URL is never used; one that this browser's cookie does
// not match is refused and counted (lib/connections.ts#refuseUnbound).
export async function GET(req: NextRequest) {
  const base = await origin();
  const me = await currentUser();
  let who: { userId: number | null; attemptId: number };
  if (me) {
    who = { userId: me.id, attemptId: me.signup_attempt_id };
  } else {
    const attemptId = await boundAttempt((await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret());
    const presented = req.nextUrl.searchParams.get('attempt');
    if (presented !== null && presented !== String(attemptId)) {
      await refuseUnbound(presented);
      return NextResponse.redirect(`${base}/login`);
    }
    if (attemptId === null) return NextResponse.redirect(`${base}/login`);
    who = { userId: null, attemptId };
  }
  // Fix round 2 (engineer, Low): mints are rate-limited per trader; over the limit, a short plain page says so.
  try {
    return NextResponse.redirect(await startConnection(who, `${base}/connect/done`));
  } catch (e) {
    if (!(e instanceof RateLimitedError)) throw e;
    return new NextResponse(PORTAL.tooMany, { status: 429, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '600' } });
  }
}
