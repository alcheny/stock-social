import { NextResponse } from 'next/server';
import { claimLink } from '@/lib/auth/links.ts';
import { signInWithIdentity } from '@/lib/auth/attempts.ts';
import { origin, rememberMethod, signIn } from '@/lib/session.ts';
import { landingFor } from '@/lib/auth/landing.ts';

// The emailed link lands here. Single use: the row is claimed atomically (and its address blanked) before any sign-in
// happens. Redirects go to the request's own origin (lib/session.ts#origin), never the server's idea of its hostname,
// so the session cookie and the landing page share a host behind any proxy or preview.
export async function GET(req: Request) {
  const base = await origin();
  const t = new URL(req.url).searchParams.get('t') ?? '';
  const claim = await claimLink(t);
  if (claim.status !== 'ok') return NextResponse.redirect(`${base}/login?error=${claim.status === 'used' ? 'used' : 'expired'}`, 303);
  const user = await signInWithIdentity(claim.attemptId, { provider: 'email', subject: claim.email, email: claim.email });
  await signIn(user.id);
  await rememberMethod('email');
  return NextResponse.redirect(`${base}${await landingFor(user)}`, 303); // an empty profile goes straight to S2 (committee item 7)
}
