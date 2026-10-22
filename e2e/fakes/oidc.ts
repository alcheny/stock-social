// In-repo OpenID Connect issuer for e2e: two providers (`/a` query response, `/b` form_post response), a key pair
// and JWKS generated at start, PKCE checked at the token endpoint. No real provider is ever contacted.
import { createServer, type Server } from 'node:http';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { signJwt } from '../../lib/auth/oidc.ts';

type Pending = { nonce: string; challenge: string; clientId: string; redirectUri: string };

export function startOidcFake(port: number): Promise<{ server: Server; base: string; setUser: (u: { sub: string; email: string }) => void }> {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `fake-${Math.random().toString(36).slice(2, 8)}`; // fresh per start, so a restarted fake looks like a key rotation
  const jwk = { ...(publicKey.export({ format: 'jwk' }) as Record<string, string>), kid, use: 'sig', alg: 'RS256' };
  const codes = new Map<string, Pending>();
  let user = { sub: 'fake-sub', email: 'fake@example.com' };
  const base = `http://127.0.0.1:${port}`;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', base);
    const [, p, ...rest] = url.pathname.split('/');
    const path = `/${rest.join('/')}`;
    const issuer = `${base}/${p}`;
    const json = (o: unknown, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (p === '_set' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      user = JSON.parse(body); return json({ ok: true });
    }
    if (path === '/.well-known/openid-configuration') return json({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` });
    if (path === '/jwks') return json({ keys: [jwk] });
    if (path === '/authorize') {
      const q = url.searchParams;
      const code = `code-${Math.random().toString(36).slice(2)}`;
      codes.set(code, { nonce: q.get('nonce') ?? '', challenge: q.get('code_challenge') ?? '', clientId: q.get('client_id') ?? '', redirectUri: q.get('redirect_uri') ?? '' });
      const state = q.get('state') ?? '';
      if (q.get('response_mode') === 'form_post') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<!doctype html><form id="f" method="post" action="${q.get('redirect_uri')}"><input name="code" value="${code}"><input name="state" value="${state}"></form><script>document.getElementById('f').submit()</script>`);
      }
      res.writeHead(302, { location: `${q.get('redirect_uri')}?code=${code}&state=${encodeURIComponent(state)}` });
      return res.end();
    }
    if (path === '/token' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      const f = new URLSearchParams(body);
      const pend = codes.get(f.get('code') ?? '');
      codes.delete(f.get('code') ?? '');
      if (!pend || createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url') !== pend.challenge || f.get('client_id') !== pend.clientId) return json({ error: 'invalid_grant' }, 400);
      const now = Math.floor(Date.now() / 1000);
      const id_token = signJwt({ alg: 'RS256', kid }, { iss: issuer, sub: user.sub, aud: pend.clientId, exp: now + 300, iat: now, nonce: pend.nonce, email: user.email, email_verified: true }, privateKey);
      return json({ access_token: 'x', token_type: 'Bearer', id_token });
    }
    json({ error: 'not found' }, 404);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, base, setUser: (u) => { user = u; } })));
}
