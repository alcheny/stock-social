// OpenID Connect code flow with PKCE, state and nonce, on node:crypto and fetch only (no dependency).
// Two providers: the email provider (provider_a) and the device maker (provider_b); both are standard OIDC.
// verifyIdToken is pure so the unit tests can sign tokens with generated keys.
import { createHash, createPublicKey, createPrivateKey, randomBytes, sign, verify, type KeyObject } from 'node:crypto';

export type Jwk = { kty: string; kid?: string; alg?: string; use?: string; n?: string; e?: string; crv?: string; x?: string; y?: string };
export type Claims = { iss?: string; sub?: string; aud?: string | string[]; azp?: string; exp?: number; iat?: number; nonce?: string; email?: string; email_verified?: boolean | string };
export type VerifyReason = 'malformed' | 'alg' | 'kid' | 'signature' | 'issuer' | 'audience' | 'expired' | 'issued_in_future' | 'nonce' | 'subject';
export type VerifyResult = { ok: true; claims: Claims & { sub: string } } | { ok: false; reason: VerifyReason };

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const fromB64u = (s: string) => Buffer.from(s, 'base64url');
const json = (s: string): unknown => { try { return JSON.parse(fromB64u(s).toString('utf8')); } catch { return null; } };

// Only asymmetric algorithms. `none`, HMAC and anything else are rejected before any key is looked at.
const ALGS: Record<string, { kty: string; crv?: string }> = { RS256: { kty: 'RSA' }, ES256: { kty: 'EC', crv: 'P-256' } };

export function verifyIdToken(i: { token: string; jwks: Jwk[]; issuer: string; clientId: string; nonce: string; now?: number }): VerifyResult {
  const parts = i.token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const header = json(parts[0]) as { alg?: string; kid?: string } | null;
  const claims = json(parts[1]) as Claims | null;
  if (!header || !claims || typeof header !== 'object' || typeof claims !== 'object') return { ok: false, reason: 'malformed' };
  const alg = ALGS[String(header.alg)];
  if (!alg) return { ok: false, reason: 'alg' };
  const key = i.jwks.find((k) => k.kty === alg.kty && (header.kid ? k.kid === header.kid : i.jwks.length === 1) && (!alg.crv || k.crv === alg.crv));
  if (!key) return { ok: false, reason: 'kid' };
  let pub: KeyObject;
  try { pub = createPublicKey({ key: key as never, format: 'jwk' }); } catch { return { ok: false, reason: 'kid' }; }
  const good = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), alg.kty === 'EC' ? { key: pub, dsaEncoding: 'ieee-p1363' } : pub, fromB64u(parts[2]));
  if (!good) return { ok: false, reason: 'signature' };
  const now = (i.now ?? Date.now()) / 1000;
  if (claims.iss !== i.issuer) return { ok: false, reason: 'issuer' };
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(i.clientId) || (aud.length > 1 && claims.azp !== i.clientId)) return { ok: false, reason: 'audience' };
  if (typeof claims.exp !== 'number' || claims.exp <= now) return { ok: false, reason: 'expired' };
  if (typeof claims.iat === 'number' && claims.iat > now + 300) return { ok: false, reason: 'issued_in_future' };
  if (!i.nonce || claims.nonce !== i.nonce) return { ok: false, reason: 'nonce' };
  if (typeof claims.sub !== 'string' || !claims.sub) return { ok: false, reason: 'subject' };
  return { ok: true, claims: claims as Claims & { sub: string } };
}

// Signs a JWT (RS256 or ES256). Used by the device provider's client-secret JWT and by the test fakes.
export function signJwt(header: { alg: 'RS256' | 'ES256'; kid?: string }, payload: Record<string, unknown>, privateKey: string | KeyObject): string {
  const h = b64u(JSON.stringify({ ...header, typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const key = typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;
  const sig = sign('sha256', Buffer.from(`${h}.${p}`), header.alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key);
  return `${h}.${p}.${b64u(sig)}`;
}

// The device maker's "client secret" is a short-lived ES256 JWT signed with the developer key.
export function clientSecretJwt(i: { teamId: string; keyId: string; privateKeyPem: string; clientId: string; audience: string; now?: number }): string {
  const iat = Math.floor((i.now ?? Date.now()) / 1000);
  return signJwt({ alg: 'ES256', kid: i.keyId }, { iss: i.teamId, iat, exp: iat + 600, aud: i.audience, sub: i.clientId }, i.privateKeyPem.replace(/\\n/g, '\n'));
}

export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export type Discovery = { authorization_endpoint: string; token_endpoint: string; jwks_uri: string; issuer: string };
type Fetch = typeof fetch;
const discoveries = new Map<string, { at: number; d: Discovery }>();
const jwksCache = new Map<string, { at: number; keys: Jwk[] }>();
const HOUR = 3_600_000;

export async function discover(issuer: string, fetchFn: Fetch = fetch): Promise<Discovery> {
  const hit = discoveries.get(issuer);
  if (hit && Date.now() - hit.at < HOUR) return hit.d;
  const res = await fetchFn(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error('discovery failed');
  const d = (await res.json()) as Discovery;
  if (!d.authorization_endpoint || !d.token_endpoint || !d.jwks_uri) throw new Error('discovery incomplete');
  discoveries.set(issuer, { at: Date.now(), d });
  return d;
}

export async function fetchJwks(uri: string, fetchFn: Fetch = fetch, force = false): Promise<Jwk[]> {
  const hit = jwksCache.get(uri);
  if (hit && !force && Date.now() - hit.at < HOUR) return hit.keys;
  const res = await fetchFn(uri);
  if (!res.ok) throw new Error('jwks fetch failed');
  const keys = ((await res.json()) as { keys?: Jwk[] }).keys ?? [];
  jwksCache.set(uri, { at: Date.now(), keys });
  return keys;
}

export type Provider = { key: 'provider_a' | 'provider_b'; issuer: string; clientId: string; clientSecret: () => string; label: string; scope: string; responseMode: 'query' | 'form_post' };

export function authorizeUrl(d: Discovery, p: Provider, i: { state: string; nonce: string; challenge: string; redirectUri: string }): string {
  const u = new URL(d.authorization_endpoint);
  const q: Record<string, string> = { response_type: 'code', client_id: p.clientId, redirect_uri: i.redirectUri, scope: p.scope, state: i.state, nonce: i.nonce,
    code_challenge: i.challenge, code_challenge_method: 'S256' };
  if (p.responseMode === 'form_post') q.response_mode = 'form_post';
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  return u.toString();
}

export async function exchangeCode(d: Discovery, p: Provider, i: { code: string; verifier: string; redirectUri: string }, fetchFn: Fetch = fetch): Promise<string> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code: i.code, redirect_uri: i.redirectUri, client_id: p.clientId, client_secret: p.clientSecret(), code_verifier: i.verifier });
  const res = await fetchFn(d.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body });
  if (!res.ok) throw new Error('token exchange failed');
  const t = (await res.json()) as { id_token?: string };
  if (!t.id_token) throw new Error('no id_token');
  return t.id_token;
}

// Full verification against the provider's JWKS; an unknown kid refetches the keys once (rotation), then fails.
export async function verifyWithProvider(d: Discovery, p: Provider, token: string, nonce: string, fetchFn: Fetch = fetch): Promise<VerifyResult> {
  let r = verifyIdToken({ token, jwks: await fetchJwks(d.jwks_uri, fetchFn), issuer: p.issuer, clientId: p.clientId, nonce });
  if (!r.ok && r.reason === 'kid') r = verifyIdToken({ token, jwks: await fetchJwks(d.jwks_uri, fetchFn, true), issuer: p.issuer, clientId: p.clientId, nonce });
  return r;
}
