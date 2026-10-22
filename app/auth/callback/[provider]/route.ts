import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { discover, exchangeCode, verifyWithProvider } from '@/lib/auth/oidc.ts';
import { providersFromEnv } from '@/lib/auth/providers.ts';
import { sessionSecret, unsignToken } from '@/lib/auth/sessions.ts';
import { signInWithIdentity } from '@/lib/auth/attempts.ts';
import { origin, signIn } from '@/lib/session.ts';
import { decodeTx, TX_COOKIE } from '@/lib/auth/tx.ts';

// The provider returns here (GET with a query, or a cross-site POST for form_post). State, nonce and PKCE verifier
// come from the signed transaction cookie set by startSignIn; the id_token is verified against the provider's JWKS.
async function finish(req: NextRequest, params: URLSearchParams, provider: string) {
  const fail = (why: string) => NextResponse.redirect(new URL(`/login?error=provider&why=${why}`, req.url), 303);
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
    const idToken = await exchangeCode(d, p, { code, verifier: tx.v, redirectUri: `${await origin()}/auth/callback/${p.key}` });
    const v = await verifyWithProvider(d, p, idToken, tx.n);
    if (!v.ok) return fail(v.reason);
    const verified = v.claims.email_verified === true || v.claims.email_verified === 'true';
    const user = await signInWithIdentity(tx.a, { provider: p.key, subject: v.claims.sub, email: verified && v.claims.email ? v.claims.email.toLowerCase() : null });
    await signIn(user.id);
    return NextResponse.redirect(new URL(`/u/${user.handle}`, req.url), 303);
  } catch {
    return fail('exchange'); // reason only: never the token, the code or the address
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  return finish(req, req.nextUrl.searchParams, (await ctx.params).provider);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const form = await req.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form.entries()) if (typeof v === 'string') params.set(k, v);
  return finish(req, params, (await ctx.params).provider);
}
