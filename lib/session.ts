// Sessions (F-1 PR-1): a signed random token in an httpOnly, sameSite=lax cookie; its sha256 in `sessions`.
// The dev sign-in form (/login/dev, the `login` action) is the only stub left and is guarded by devGuard():
// it throws in production unless ALLOW_DEV_AUTH=1, exactly as the old stub did.
import { cookies, headers } from 'next/headers';
import { sql } from './db.ts';
import { createSession, deleteSession, SESSION_COOKIE, SESSION_DAYS, sessionSecret, signToken, unsignToken, userIdForSession } from './auth/sessions.ts';

export function devGuard() {
  const building = process.env.NEXT_PHASE === 'phase-production-build';
  if (process.env.NODE_ENV === 'production' && !building && process.env.ALLOW_DEV_AUTH !== '1') {
    throw new Error('Dev sign-in is disabled in production.');
  }
}
export const devAuthAllowed = () => process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_AUTH === '1';

export type User = {
  id: number; handle: string; display_name: string; excluded_positions: number;
  snaptrade_user_id: string | null; snaptrade_secret_enc: string | null; last_synced_at: Date | null;
  share_prompt_seen_at: Date | null; signup_attempt_id: number;
};

export async function currentUser(): Promise<User | null> {
  const token = unsignToken((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
  const id = await userIdForSession(token);
  if (!id) return null;
  const [u] = await sql<User[]>`select * from users where id = ${id}`;
  return u ?? null;
}

async function secure(): Promise<boolean> {
  if ((process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://')) return true;
  return (await headers()).get('x-forwarded-proto') === 'https';
}

export async function signIn(userId: number) {
  const token = await createSession(userId);
  (await cookies()).set(SESSION_COOKIE, signToken(token, sessionSecret()), { httpOnly: true, sameSite: 'lax', path: '/', secure: await secure(), maxAge: SESSION_DAYS * 86_400 });
}

export async function signOut() {
  const jar = await cookies();
  await deleteSession(unsignToken(jar.get(SESSION_COOKIE)?.value, sessionSecret()));
  jar.delete(SESSION_COOKIE);
}

// Public origin for links and OIDC redirect URIs: the configured site URL, else the request's host.
export async function origin(): Promise<string> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) return site.replace(/\/$/, '');
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'}`;
}
