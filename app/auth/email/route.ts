import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db.ts';
import { hashToken, linkStatus } from '@/lib/auth/links.ts';
import { signInWithIdentity } from '@/lib/auth/attempts.ts';
import { signIn } from '@/lib/session.ts';

// The emailed link lands here. Single use: the row is claimed atomically before any sign-in happens.
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') ?? '';
  const expired = () => NextResponse.redirect(new URL('/login?error=expired', req.url), 303);
  if (!/^[A-Za-z0-9_-]{20,}$/.test(t)) return expired();
  const [row] = await sql`select email, attempt_id, expires_at, used_at from login_links where token_hash = ${hashToken(t)}`;
  if (linkStatus(row as { expires_at: Date; used_at: Date | null } | undefined) !== 'ok') return expired();
  const [claimed] = await sql`update login_links set used_at = now() where token_hash = ${hashToken(t)} and used_at is null returning email`;
  if (!claimed) return expired();
  const email = String(claimed.email);
  const user = await signInWithIdentity(Number(row.attempt_id), { provider: 'email', subject: email, email });
  await signIn(user.id);
  return NextResponse.redirect(new URL(`/u/${user.handle}`, req.url), 303);
}
