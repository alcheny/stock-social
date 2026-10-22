import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getAttempt } from '@/lib/auth/attempts.ts';
import { attemptCookieValue } from '@/lib/auth/links.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { CONNECT_COOKIE, startConnection } from '@/lib/connections.ts';
import { currentUser, origin } from '@/lib/session.ts';

// S2 → the vendor's read-only portal (today's redirect flow; PR-2b embeds it). Signed in, the connection hangs off the
// user; brokerage-first (signed out, `?attempt=`), off the attested attempt, bound to this browser by a signed cookie.
export async function GET(req: NextRequest) {
  const base = await origin();
  const me = await currentUser();
  let who: { userId: number | null; attemptId: number };
  if (me) {
    who = { userId: me.id, attemptId: me.signup_attempt_id };
  } else {
    const a = await getAttempt(Number(req.nextUrl.searchParams.get('attempt')));
    if (!a || a.method !== 'brokerage' || a.user_id !== null || a.completed_at) return NextResponse.redirect(`${base}/login`);
    who = { userId: null, attemptId: a.id };
    (await cookies()).set(CONNECT_COOKIE, attemptCookieValue(a.id, sessionSecret()), { httpOnly: true, sameSite: 'lax', path: '/connect', maxAge: 86_400, secure: base.startsWith('https://') });
  }
  return NextResponse.redirect(await startConnection(who, `${base}/connect/done`));
}
