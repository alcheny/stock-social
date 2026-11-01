import { NextResponse } from 'next/server';
import { AFTER_SIGNIN_COOKIE } from '@/lib/record-tools.ts';
import { siteOrigin } from '@/lib/billing.ts';

// F-3 (business lead user test, demand 1): "Sign in to subscribe" brings the viewer back to Record tools after sign-in
// instead of the broker-connect screen. A first-party cookie naming one fixed destination (never a URL from the
// request: no open redirect), read once by the sign-in landing.
export function GET() {
  const res = NextResponse.redirect(`${siteOrigin()}/login`, 303);
  res.cookies.set(AFTER_SIGNIN_COOKIE, 'tools', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 });
  return res;
}
