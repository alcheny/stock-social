import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { authorizeUrl, clientSecretJwt, exchangeCode, pkce, signJwt, verifyIdToken, verifyWithProvider, type Jwk, type Provider } from './oidc.ts';

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = (k: typeof rsa.publicKey, kid: string): Jwk => ({ ...(k.export({ format: 'jwk' }) as Jwk), kid });
const JWKS = [jwk(rsa.publicKey, 'rsa-1'), jwk(ec.publicKey, 'ec-1')];
const ISS = 'https://issuer.example';
const AUD = 'client-123';
const NONCE = 'n0nce';
const now = 1_800_000_000_000;
const base = () => ({ iss: ISS, sub: 'subject-1', aud: AUD, exp: now / 1000 + 600, iat: now / 1000 - 5, nonce: NONCE, email: 'a@example.com', email_verified: true });
const mint = (claims: Record<string, unknown>, h: { alg: 'RS256' | 'ES256'; kid?: string } = { alg: 'RS256', kid: 'rsa-1' }, key = rsa.privateKey) => signJwt(h, claims, key);
const check = (token: string, over: Partial<Parameters<typeof verifyIdToken>[0]> = {}) => verifyIdToken({ token, jwks: JWKS, issuer: ISS, clientId: AUD, nonce: NONCE, now, ...over });

test('verifyIdToken accepts a valid RS256 and ES256 token', () => {
  const r = check(mint(base()));
  assert.ok(r.ok && r.claims.sub === 'subject-1' && r.claims.email === 'a@example.com');
  assert.ok(check(mint(base(), { alg: 'ES256', kid: 'ec-1' }, ec.privateKey)).ok);
});

test('verifyIdToken rejects wrong audience, including an audience list without azp', () => {
  assert.deepEqual(check(mint({ ...base(), aud: 'someone-else' })), { ok: false, reason: 'audience' });
  assert.deepEqual(check(mint({ ...base(), aud: [AUD, 'x'] })), { ok: false, reason: 'audience' });
  assert.ok(check(mint({ ...base(), aud: [AUD, 'x'], azp: AUD })).ok);
});

test('verifyIdToken rejects alg none and HS256 before looking at keys', () => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.deepEqual(check(`${b64({ alg: 'none' })}.${b64(base())}.`), { ok: false, reason: 'alg' });
  assert.deepEqual(check(`${b64({ alg: 'HS256', kid: 'rsa-1' })}.${b64(base())}.${b64('sig')}`), { ok: false, reason: 'alg' });
});

test('verifyIdToken rejects an unknown kid, a kid/alg mismatch and a bad signature', () => {
  assert.deepEqual(check(mint(base(), { alg: 'RS256', kid: 'rsa-9' })), { ok: false, reason: 'kid' });
  assert.deepEqual(check(mint(base(), { alg: 'ES256', kid: 'rsa-1' }, ec.privateKey)), { ok: false, reason: 'kid' });
  assert.deepEqual(check(mint(base(), { alg: 'RS256', kid: 'rsa-1' }, other.privateKey)), { ok: false, reason: 'signature' });
  const t = mint(base());
  assert.deepEqual(check(t.slice(0, -4) + 'AAAA'), { ok: false, reason: 'signature' });
});

test('verifyIdToken rejects wrong issuer, expiry, future iat, nonce mismatch and malformed input', () => {
  assert.deepEqual(check(mint({ ...base(), iss: 'https://evil.example' })), { ok: false, reason: 'issuer' });
  assert.deepEqual(check(mint({ ...base(), exp: now / 1000 - 1 })), { ok: false, reason: 'expired' });
  assert.deepEqual(check(mint({ ...base(), iat: now / 1000 + 3600 })), { ok: false, reason: 'issued_in_future' });
  assert.deepEqual(check(mint({ ...base(), nonce: 'other' })), { ok: false, reason: 'nonce' });
  assert.deepEqual(check(mint({ ...base(), nonce: undefined })), { ok: false, reason: 'nonce' });
  assert.deepEqual(check(mint({ ...base(), sub: '' })), { ok: false, reason: 'subject' });
  assert.deepEqual(check('not.a.jwt.at.all'), { ok: false, reason: 'malformed' });
  assert.deepEqual(check('a.b'), { ok: false, reason: 'malformed' });
});

test('pkce challenge is the S256 of the verifier; authorize URL carries state, nonce, PKCE and response_mode', () => {
  const { verifier, challenge } = pkce();
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
  const p: Provider = { key: 'provider_b', issuer: ISS, clientId: AUD, clientSecret: () => 's', label: 'L', scope: 'openid email', responseMode: 'form_post' };
  const u = new URL(authorizeUrl({ authorization_endpoint: `${ISS}/auth`, token_endpoint: `${ISS}/token`, jwks_uri: `${ISS}/jwks`, issuer: ISS }, p, { state: 'st', nonce: 'no', challenge, redirectUri: 'https://app.example/cb' }));
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('state'), 'st');
  assert.equal(u.searchParams.get('nonce'), 'no');
  assert.equal(u.searchParams.get('response_mode'), 'form_post');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://app.example/cb');
});

test('clientSecretJwt is an ES256 JWT the provider can verify with the developer key', () => {
  const pem = ec.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const jwt = clientSecretJwt({ teamId: 'TEAM', keyId: 'ec-1', privateKeyPem: pem, clientId: AUD, audience: ISS, now });
  const r = verifyIdToken({ token: jwt, jwks: JWKS, issuer: 'TEAM', clientId: ISS, nonce: '', now });
  assert.deepEqual(r, { ok: false, reason: 'nonce' }); // signature, issuer and audience passed; a client secret has no nonce
  assert.ok(createPrivateKey(pem));
});

test('exchangeCode posts the verifier and client secret; verifyWithProvider refetches JWKS once on an unknown kid', async () => {
  const p: Provider = { key: 'provider_a', issuer: ISS, clientId: AUD, clientSecret: () => 'sec', label: 'L', scope: 'openid email', responseMode: 'query' };
  const d = { authorization_endpoint: `${ISS}/auth`, token_endpoint: `${ISS}/token`, jwks_uri: `${ISS}/jwks-${Math.random()}`, issuer: ISS };
  const calls: string[] = [];
  const rotated = [jwk(other.publicKey, 'rsa-2')];
  let jwksServed = 0;
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(String(url));
    if (String(url) === d.token_endpoint) {
      const b = new URLSearchParams(String(init?.body));
      assert.equal(b.get('code_verifier'), 'ver');
      assert.equal(b.get('client_secret'), 'sec');
      assert.equal(b.get('grant_type'), 'authorization_code');
      return new Response(JSON.stringify({ id_token: 'tok' }), { status: 200 });
    }
    jwksServed++;
    return new Response(JSON.stringify({ keys: jwksServed === 1 ? JWKS : rotated }), { status: 200 });
  }) as typeof fetch;
  assert.equal(await exchangeCode(d, p, { code: 'c', verifier: 'ver', redirectUri: 'https://app.example/cb' }, fetchFn), 'tok');
  const tok = signJwt({ alg: 'RS256', kid: 'rsa-2' }, { ...base(), exp: Date.now() / 1000 + 60, iat: Date.now() / 1000 }, other.privateKey);
  const r = await verifyWithProvider(d, p, tok, NONCE, fetchFn);
  assert.ok(r.ok);
  assert.equal(jwksServed, 2);
  const bad = signJwt({ alg: 'RS256', kid: 'rsa-3' }, { ...base(), exp: Date.now() / 1000 + 60 }, other.privateKey);
  assert.deepEqual(await verifyWithProvider(d, p, bad, NONCE, fetchFn), { ok: false, reason: 'kid' });
});
