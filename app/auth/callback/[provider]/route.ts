import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { discover, exchangeCode, verifyWithProvider } from '@/lib/auth/oidc.ts';
import { providersFromEnv } from '@/lib/auth/providers.ts';
import { sessionSecret, unsignToken } from '@/lib/auth/sessions.ts';
import { signInWithIdentity } from '@/lib/auth/attempts.ts';
import { origin, rememberMethod, signIn } from '@/lib/session.ts';
import { landingFor } from '@/lib/auth/landing.ts';
import { decodeTx, TX_COOKIE } from '@/lib/auth/tx.ts';

// The provider returns here (GET with a query, or a cross-site POST for form_post). State, nonce and PKCE verifier
// come from the signed transaction cookie set by startSignIn; the id_token is verified against the provider's JWKS.
// Redirects use the request's origin (lib/session.ts#origin), never req.url's hostname.
async function finish(params: URLSearchParams, provider: string) {
  const base = await origin();
  const fail = (why: string) => NextResponse.redirect(`${base}/login?error=provider&why=${why}`, 303);
  const p = providersFromEnv().find((x) => x.key === provider);
  if (!p) return fail('unknown');
  const jar = await cookies();
  const tx = decodeTx(unsignToken(jar.get(TX_COOKIE)?.value, sessionSecret()));
  jar.delete(TX_COOKIE);
  if (!tx) return fail('tx');
  const code = params.get('code'), state = params.get('state');
  if (tx.m !== provider || !code || !state || state !== tx.s) return fail('state');
  try {
    const d = await discover(p.issuer);
    const idToken = await exchangeCode(d, p, { code, verifier: tx.v, redirectUri: `${base}/auth/callback/${p.key}` });
    const v = await verifyWithProvider(d, p, idToken, tx.n);
    if (!v.ok) return fail(v.reason);
    const verified = v.claims.email_verified === true || v.claims.email_verified === 'true';
    const user = await signInWithIdentity(tx.a, { provider: p.key, subject: v.claims.sub, email: verified && v.claims.email ? v.claims.email.toLowerCase() : null });
    await signIn(user.id);
    await rememberMethod(p.key);
    return NextResponse.redirect(`${base}${await landingFor(user)}`, 303) // an empty profile goes straight to S2 (committee item 7);
  } catch {
    return fail('exchange'); // reason only: never the token, the code or the address
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  return finish(req.nextUrl.searchParams, (await ctx.params).provider);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const form = await req.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form.entries()) if (typeof v === 'string') params.set(k, v);
  return finish(params, (await ctx.params).provider);
}
