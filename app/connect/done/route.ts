import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser, origin, rememberMethod, signIn } from '@/lib/session.ts';
import { sessionSecret, unsignToken } from '@/lib/auth/sessions.ts';
import { completeLink, CONNECT_COOKIE } from '@/lib/connections.ts';

// Back from the portal: zero-depth validation (F-1). Lists accounts, records the link and the provisional claims,
// imports nothing, then shows the consent screen. Mechanic (a): a link whose accounts are all one existing trader's
// signs that trader in and the new link is dropped.
export async function GET() {
  const base = await origin();
  const me = await currentUser();
  const jar = await cookies();
  const attempt = Number(unsignToken(jar.get(CONNECT_COOKIE)?.value, sessionSecret()));
  if (!me && !(attempt > 0)) return NextResponse.redirect(`${base}/login`);
  const who = me ? { userId: me.id, attemptId: me.signup_attempt_id } : { userId: null, attemptId: attempt };
  const out = await completeLink(who);
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
