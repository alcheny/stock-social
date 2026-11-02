import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, portalFrameOrigins } from './lib/csp.ts';
import { ATTEST_KEEP_COOKIE, ATTEST_KEEP_PATH } from './lib/auth/attest-keep.ts'; // FIXES-CYCLE5 (F5-7)

// Security hardening (2026-11-01), F27: a fresh nonce per request and the Content-Security-Policy built from it
// (lib/csp.ts), on the request (Next reads the nonce from it and puts it on its own scripts) and on the response.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const https = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
  const csp = contentSecurityPolicy({ nonce, dev, https, frameOrigins: portalFrameOrigins() });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  // F-16/F-17 (plan §11): the request path for app/u/[handle]/not-found.tsx, which gets no props. Set, so a client's
  // own x-ss-path is overwritten.
  requestHeaders.set('x-ss-path', request.nextUrl.pathname);
  // FIXES-CYCLE5 (F5-7; legal committee 2026-11-02 A5): the kept 18+ tick is read only by the render the sign-in
  // action's own bounce makes. Next serves that render in the action's response by fetching the redirect target from
  // this server, with the action's response headers merged in (x-action-redirect) and its new cookie. Any other
  // /login request (a reload, a typed or shared link, a back navigation) never sees it: it is removed from the request
  // and cleared in the response, so the box is ticked at most once. A cross-site page cannot add that header (it is
  // not CORS-safelisted) and cannot set the httpOnly cookie; the page also needs error=email (lib/auth/attest-keep.ts).
  // ponytail: without JavaScript the bounce is a 303 and a plain GET, indistinguishable from a reload, so the box comes
  // back unticked and the error asks for the tick again (the committee's compliant fallback) — fix: a one-use nonce in
  // the cookie matched against a server-side table, if no-JS users ever need the kept tick.
  const bounce = request.method === 'POST' || request.headers.has('x-action-redirect');
  const dropTick = !bounce && request.nextUrl.pathname === ATTEST_KEEP_PATH && request.cookies.has(ATTEST_KEEP_COOKIE);
  if (dropTick) {
    request.cookies.delete(ATTEST_KEEP_COOKIE);
    requestHeaders.set('cookie', request.cookies.toString());
  }
  // end FIXES-CYCLE5
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (dropTick) response.cookies.set(ATTEST_KEEP_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: ATTEST_KEEP_PATH, maxAge: 0, secure: https }); // FIXES-CYCLE5 (F5-7)
  return response;
}

// Static files and image optimization carry the static headers only (next.config.ts).
export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)' }],
};
