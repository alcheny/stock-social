// Passwordless email links: a random token in the URL, its sha256 in login_links, single use, 15 minutes.
import { createHash, randomBytes } from 'node:crypto';

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

// Lower-cased, trimmed, one @, no spaces, bounded. Not a deliverability check: the link proves the address.
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
