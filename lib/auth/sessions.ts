// Server sessions: a random token, HMAC-signed into the cookie (SESSION_SECRET), sha256 in the sessions table.
// No Next imports here so node:test can cover it; lib/session.ts is the cookie glue.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { sql } from '../db.ts';

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex'); // same digest as lib/auth/links.ts

export type Env = Record<string, string | undefined>;
export const SESSION_COOKIE = 'sid';
export const SESSION_DAYS = 30;

export function sessionSecret(env: Env = process.env): string {
  const s = env.SESSION_SECRET || env.APP_SECRET_KEY;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}
const mac = (token: string, key: string) => createHmac('sha256', key).update(token).digest('base64url');
export const signToken = (token: string, key: string) => `${token}.${mac(token, key)}`;
export function unsignToken(value: string | undefined | null, key: string): string | null {
  if (!value) return null;
  const i = value.lastIndexOf('.');
  if (i < 1) return null;
  const token = value.slice(0, i);
  const sig = Buffer.from(value.slice(i + 1));
  const want = Buffer.from(mac(token, key));
  return sig.length === want.length && timingSafeEqual(sig, want) ? token : null;
}

// `replacing` is the token of the session this browser already holds (signing in while signed in): its row goes in
// the same transaction, so one browser never keeps two live sessions.
export async function createSession(userId: number, now = new Date(), replacing: string | null = null): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await sql.begin(async (tx) => {
    if (replacing) await tx`delete from sessions where token_hash = ${hashToken(replacing)}`;
    await tx`insert into sessions (token_hash, user_id, created_at, expires_at, last_seen_at) values (${hashToken(token)}, ${userId}, ${now}, ${expires}, ${now})`;
  });
  return token;
}

export async function userIdForSession(token: string | null, now = new Date()): Promise<number | null> {
  if (!token) return null;
  const h = hashToken(token);
  const [s] = await sql`select user_id from sessions where token_hash = ${h} and expires_at > ${now}`;
  if (!s) return null;
  await sql`update sessions set last_seen_at = ${now} where token_hash = ${h} and last_seen_at < ${now}::timestamptz - interval '1 hour'`;
  return s.user_id as number;
}

export async function deleteSession(token: string | null) {
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
}
