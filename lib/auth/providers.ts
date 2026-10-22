// Sign-in methods from configuration. A provider button renders only when its variables are all set;
// the email link always works. Names and labels come from the environment, never from repo copy (POLICY T1).
import { clientSecretJwt, type Provider } from './oidc.ts';

export type Env = Record<string, string | undefined>;
export type MethodKey = 'provider_a' | 'provider_b' | 'email' | 'brokerage';

export function providersFromEnv(env: Env = process.env): Provider[] {
  const out: Provider[] = [];
  const a = { issuer: env.AUTH_EMAIL_PROVIDER_ISSUER, id: env.AUTH_EMAIL_PROVIDER_CLIENT_ID, secret: env.AUTH_EMAIL_PROVIDER_CLIENT_SECRET };
  if (a.issuer && a.id && a.secret) {
    out.push({ key: 'provider_a', issuer: a.issuer.replace(/\/$/, ''), clientId: a.id, clientSecret: () => a.secret!, label: env.AUTH_EMAIL_PROVIDER_LABEL || 'your email account',
      scope: 'openid email', responseMode: env.AUTH_EMAIL_PROVIDER_RESPONSE_MODE === 'form_post' ? 'form_post' : 'query' });
  }
  const b = { issuer: env.AUTH_DEVICE_PROVIDER_ISSUER, id: env.AUTH_DEVICE_PROVIDER_CLIENT_ID, secret: env.AUTH_DEVICE_PROVIDER_CLIENT_SECRET,
    team: env.AUTH_DEVICE_PROVIDER_TEAM_ID, kid: env.AUTH_DEVICE_PROVIDER_KEY_ID, pem: env.AUTH_DEVICE_PROVIDER_PRIVATE_KEY };
  if (b.issuer && b.id && (b.secret || (b.team && b.kid && b.pem))) {
    const issuer = b.issuer.replace(/\/$/, '');
    out.push({ key: 'provider_b', issuer, clientId: b.id, label: env.AUTH_DEVICE_PROVIDER_LABEL || 'your phone account',
      clientSecret: () => b.secret ?? clientSecretJwt({ teamId: b.team!, keyId: b.kid!, privateKeyPem: b.pem!, clientId: b.id!, audience: issuer }),
      scope: 'openid email', responseMode: env.AUTH_DEVICE_PROVIDER_RESPONSE_MODE === 'query' ? 'query' : 'form_post' });
  }
  return out;
}

// Order on S1: the device maker's button first on its own phones (a user-agent pattern from config), the email
// provider first elsewhere; email link third; brokerage always fourth, under its "or" divider. The last method that
// completed a sign-in (the auth_last_method cookie, lib/session.ts#rememberMethod) moves first, on the server.
export function orderMethods(i: { available: MethodKey[]; deviceFirst: boolean; last?: string | null }): MethodKey[] {
  const base: MethodKey[] = i.deviceFirst ? ['provider_b', 'provider_a', 'email', 'brokerage'] : ['provider_a', 'provider_b', 'email', 'brokerage'];
  const list = base.filter((m) => m === 'email' || m === 'brokerage' || i.available.includes(m));
  if (i.last && i.last !== 'brokerage' && (list as string[]).includes(i.last)) return [i.last as MethodKey, ...list.filter((m) => m !== i.last)];
  return list;
}

export function deviceFirst(userAgent: string | null | undefined, env: Env = process.env): boolean {
  const pattern = env.AUTH_DEVICE_PROVIDER_UA_PATTERN;
  if (!pattern || !userAgent) return false;
  try { return new RegExp(pattern, 'i').test(userAgent); } catch { return false; }
}
