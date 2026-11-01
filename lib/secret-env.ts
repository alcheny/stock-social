// Security hardening (2026-11-01), F01: a public production server refuses to start with a missing, short or
// placeholder secret. APP_SECRET_KEY encrypts vendor secrets and (without SESSION_SECRET) signs cookies; CRON_SECRET
// guards the cron route. The error names the variable, never its value. Not checked in development, during the build,
// or on a deployment marked non-public (ALLOW_DEV_AUTH=1: CI and e2e run a production build with short test values).
export class SecretEnvError extends Error { constructor(name: string) { super(`${name} must be a random string of at least 32 characters (not a placeholder)`); } }

export class DevAuthInProductionError extends Error { constructor() { super('ALLOW_DEV_AUTH must not be set on the production deployment'); } }

const PLACEHOLDER = /change-?me|example|placeholder|secret|ci-only/i;
const weak = (v: string | undefined) => !v || v.length < 32 || PLACEHOLDER.test(v);

export function assertSecrets(env: Record<string, string | undefined> = process.env): void {
  // The dev sign-in (/login/dev) signs anyone into any handle: never on Vercel's production environment (previews and
  // the e2e build, where VERCEL_ENV is 'preview' or unset, keep it).
  if (env.ALLOW_DEV_AUTH === '1' && env.VERCEL_ENV === 'production' && env.NEXT_PHASE !== 'phase-production-build') throw new DevAuthInProductionError();
  if (env.NODE_ENV !== 'production' || env.NEXT_PHASE === 'phase-production-build' || env.ALLOW_DEV_AUTH === '1') return;
  for (const name of ['APP_SECRET_KEY', 'CRON_SECRET']) if (weak(env[name])) throw new SecretEnvError(name);
  if (env.SESSION_SECRET && weak(env.SESSION_SECRET)) throw new SecretEnvError('SESSION_SECRET');
}
