// DEV-ONLY AUTH STUB. The cookie holds a plain user id, so anyone can impersonate anyone.
// Launch gate (docs/DESIGN.md Stage 2, CEO): replace this file with managed auth before any public launch.
import { cookies } from 'next/headers';
import { sql } from './db.ts';

function guard() {
  const building = process.env.NEXT_PHASE === 'phase-production-build';
  if (process.env.NODE_ENV === 'production' && !building && process.env.ALLOW_DEV_AUTH !== '1') {
    throw new Error('Dev auth stub is disabled in production. Replace lib/session.ts.');
  }
}

export type User = {
  id: number; handle: string; display_name: string; excluded_positions: number;
  snaptrade_user_id: string | null; snaptrade_secret_enc: string | null; last_synced_at: Date | null;
};

export async function currentUser(): Promise<User | null> {
  guard();
  const id = Number((await cookies()).get('uid')?.value);
  if (!id) return null;
  const [u] = await sql<User[]>`select * from users where id = ${id}`;
  return u ?? null;
}

export async function signIn(userId: number) {
  guard();
  (await cookies()).set('uid', String(userId), { httpOnly: true, sameSite: 'lax', path: '/' });
}
