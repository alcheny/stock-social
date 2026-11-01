import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ATTEMPT_COOKIE, ownsAttempt, peekLink } from '@/lib/auth/links.ts';
import { sessionSecret } from '@/lib/auth/sessions.ts';
import { origin } from '@/lib/session.ts';
import { finishEmailLink } from './finish.ts';

// The emailed link lands here. Redirects go to the request's own origin (lib/session.ts#origin), never the server's
// idea of its hostname, so the session cookie and the landing page share a host behind any proxy or preview.
// Security hardening (2026-11-01), F14: opening the link only reads it. In the browser that asked for it (the signed
// attempt cookie names the link's attempt) it signs in at once, as before. Anywhere else (another device, a mail
// scanner, a page that lured someone into opening an attacker's link) it shows a confirm step whose POST signs in, so a
// GET never claims a link or signs a stranger's browser into someone else's account.
export async function GET(req: Request) {
  const base = await origin();
  const t = new URL(req.url).searchParams.get('t') ?? '';
  const peek = await peekLink(t);
  if (peek.status !== 'ok') return NextResponse.redirect(`${base}/login?error=${peek.status === 'used' ? 'used' : 'expired'}`, 303);
  if (!ownsAttempt((await cookies()).get(ATTEMPT_COOKIE)?.value, peek.attemptId, sessionSecret())) {
    return NextResponse.redirect(`${base}/auth/email/confirm?t=${encodeURIComponent(t)}`, 303);
  }
  return NextResponse.redirect(`${base}${await finishEmailLink(t)}`, 303);
}
