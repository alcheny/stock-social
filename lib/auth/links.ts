// Passwordless email links: a random token in the URL, its sha256 in login_links, single use, 15 minutes.
import { createHash, randomBytes } from 'node:crypto';
import { sql } from '../db.ts';
import type { Sender } from './email.ts';
import { signToken, unsignToken } from './sessions.ts';

export const LINK_MINUTES = 15;
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const newLinkToken = () => { const token = randomBytes(32).toString('base64url'); return { token, hash: hashToken(token) }; };

export type LinkRow = { expires_at: Date; used_at: Date | null };
export type LinkStatus = 'missing' | 'used' | 'expired' | 'ok';
export function linkStatus(row: LinkRow | undefined | null, now = new Date()): LinkStatus {
  if (!row) return 'missing';
  if (row.used_at) return 'used';
  if (row.expires_at.getTime() <= now.getTime()) return 'expired';
  return 'ok';
}
export const linkExpiry = (now = new Date()) => new Date(now.getTime() + LINK_MINUTES * 60_000);

// The link's own status after the claim: 'ok' means this call claimed it and signs the attempt in.
export type Claim = { status: 'ok'; email: string; attemptId: number } | { status: Exclude<LinkStatus, 'ok'> };

// Single use, and the address never outlives the link (POLICY P6, COMPLIANCE §3): the one atomic update marks the row
// used and blanks the address. The row itself stays until purgeExpiredLinks so a second tap can say "already used".
export async function claimLink(token: string, now = new Date()): Promise<Claim> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return { status: 'missing' };
  const hash = hashToken(token);
  const [row] = await sql`select email, attempt_id, expires_at, used_at from login_links where token_hash = ${hash}`;
  const status = linkStatus(row as LinkRow | undefined, now);
  if (status !== 'ok') return { status };
  const [claimed] = await sql`update login_links set used_at = ${now}, email = '' where token_hash = ${hash} and used_at is null returning attempt_id`;
  if (!claimed) return { status: 'used' }; // lost the race to another tap on the same link
  return { status: 'ok', email: String(row.email), attemptId: Number(row.attempt_id) };
}

// Expired rows (claimed or not) go with their address: from the hourly tick and lazily before every send.
export async function purgeExpiredLinks(now = new Date()): Promise<number> {
  const rows = await sql`delete from login_links where expires_at <= ${now} returning 1`;
  return rows.length;
}

// A sign-in link must carry the configured public origin: without NEXT_PUBLIC_SITE_URL, origin() trusts the Host header
// and a forged Host would put an attacker's host into a trader's link. Production refuses to send unless ALLOW_DEV_AUTH=1
// marks the deployment non-public (the same marker lib/auth/email.ts#defaultSender honors; e2e runs a production build).
export class SiteUrlMissingError extends Error { constructor() { super('NEXT_PUBLIC_SITE_URL must be set to send sign-in links in production'); } }
export function requireLinkOrigin(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV === 'production' && !env.NEXT_PUBLIC_SITE_URL && env.ALLOW_DEV_AUTH !== '1') throw new SiteUrlMissingError();
}

// Lower-cased, trimmed, one @, no spaces, bounded. Not a deliverability check: the link proves the address.
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

// The send failed: the link row is closed (used_at) so nothing claimable is left behind; the attempt stays and the
// trader retries from /login/sent. The message carries no address, token or link.
export class SendFailedError extends Error { constructor() { super('the sign-in link could not be sent'); } }

// Writes the link row, then sends. On a send failure the row is marked used in the same breath and SendFailedError
// is thrown, so no link that nobody received can ever sign someone in.
export async function issueLink(attemptId: number, email: string, send: Sender, originUrl: string): Promise<void> {
  await purgeExpiredLinks();
  const { token, hash } = newLinkToken();
  await sql`insert into login_links (token_hash, email, attempt_id, expires_at) values (${hash}, ${email}, ${attemptId}, ${linkExpiry()})`;
  try {
    await send({ to: email, url: `${originUrl}/auth/email?t=${token}` });
  } catch {
    await sql`update login_links set used_at = now() where token_hash = ${hash} and used_at is null`;
    throw new SendFailedError();
  }
}

// The address behind an open (not completed) attempt, for "Send again". Null when there is none.
export async function pendingLinkEmail(attemptId: number): Promise<string | null> {
  const [row] = await sql`select l.email from login_links l join signup_attempts a on a.id = l.attempt_id
    where l.attempt_id = ${attemptId} and a.completed_at is null order by l.expires_at desc limit 1`;
  return row ? String(row.email) : null;
}

// "Send again" belongs to the browser that started the attempt: a signed cookie holds the attempt id (ids are
// sequential, so the id alone proves nothing). Pure helpers; the cookie glue is in app/auth/actions.ts.
export const ATTEMPT_COOKIE = 'login_attempt';
// The address typed before a validation redirect, and the one a link was sent to (kept 15 minutes, the link's life,
// httpOnly, path /login; never in a URL). /login reads it back into the field, so an expired or used link needs no retyping.
export const EMAIL_COOKIE = 'login_email';
export const EMAIL_COOKIE_SECONDS = LINK_MINUTES * 60;
export const attemptCookieValue = (attemptId: number, secret: string) => signToken(String(attemptId), secret);
export function ownsAttempt(cookieValue: string | undefined | null, attemptId: number, secret: string): boolean {
  const v = unsignToken(cookieValue, secret);
  return v !== null && Number.isInteger(attemptId) && attemptId > 0 && v === String(attemptId);
}
