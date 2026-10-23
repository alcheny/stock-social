import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser, origin, rememberMethod, signIn } from '@/lib/session.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { boundAttempt, completeLink, CONNECT_COOKIE, refuseUnbound } from '@/lib/connections.ts';

// Back from the portal (redirect flow, or the embedded modal): zero-depth validation (F-1). Lists accounts, records the link and the provisional claims,
// imports nothing, then shows the consent screen. Mechanic (a): a link whose accounts are all one existing trader's
// signs that trader in and the new link is dropped. Signed out, only the attempt bound to this browser by the signed
// cookie counts (committee fix, High); an attempt id in the URL that the cookie does not match is refused and counted.
export async function GET(req: NextRequest) {
  const base = await origin();
  const me = await currentUser();
  const attempt = me ? null : await boundAttempt((await cookies()).get(CONNECT_COOKIE)?.value, sessionSecret());
  const presented = req.nextUrl.searchParams.get('attempt');
  if (!me && presented !== null && presented !== String(attempt)) {
    await refuseUnbound(presented);
    return NextResponse.redirect(`${base}/login`);
  }
  if (!me && attempt === null) return NextResponse.redirect(`${base}/login`);
  const who = me ? { userId: me.id, attemptId: me.signup_attempt_id } : { userId: null, attemptId: attempt! };
  // PR-2b: the embedded modal returns here with m=embedded (on SUCCESS or when the portal closes); anything else is the
  // redirect flow. Only these two values are read; the link itself is whatever the vendor lists for this user.
  const out = await completeLink(who, undefined, undefined, req.nextUrl.searchParams.get('m') === 'embedded' ? 'embedded' : 'redirect');
  switch (out.kind) {
    case 'consent': return NextResponse.redirect(`${base}/connect/consent?c=${out.id}`);
    case 'none': return NextResponse.redirect(`${base}/connect/result?c=${out.id}&k=none`);
    case 'refused': return NextResponse.redirect(me ? `${base}/u/${me.handle}?connect=account-claimed` : `${base}/connect/result?c=${out.id}&k=refused`);
    case 'signin': {
      await signIn(out.userId);
      await rememberMethod('brokerage');
      return NextResponse.redirect(`${base}/u/${out.handle}`);
    }
    default: return NextResponse.redirect(`${base}/connect/result?k=abandoned`); // signed in or not: the portal returned without a link (S7a)
  }
}
