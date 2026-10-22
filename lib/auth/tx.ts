// The OIDC transaction (state, nonce, PKCE verifier, attempt, method) travels in a signed, short-lived cookie.
import type { Method } from './attempts.ts';

export const TX_COOKIE = 'auth_tx';
export type Tx = { s: string; n: string; v: string; a: number; m: Method };
export const encodeTx = (tx: Tx) => Buffer.from(JSON.stringify(tx)).toString('base64url');
export function decodeTx(raw: string | null): Tx | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Tx;
    return typeof t.s === 'string' && typeof t.n === 'string' && typeof t.v === 'string' && typeof t.a === 'number' ? t : null;
  } catch { return null; }
}
