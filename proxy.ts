import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy } from './lib/csp.ts';

// Security hardening (2026-11-01), F27: a fresh nonce per request and the Content-Security-Policy built from it
// (lib/csp.ts), on the request (Next reads the nonce from it and puts it on its own scripts) and on the response.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const https = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
  const csp = contentSecurityPolicy({ nonce, dev, https, vendorBaseUrl: process.env.SNAPTRADE_BASE_URL });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

// Static files and image optimization carry the static headers only (next.config.ts).
export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)' }],
};
