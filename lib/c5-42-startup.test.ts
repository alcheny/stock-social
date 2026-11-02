// C5-42 (approval council cycle 5, chore lane): behavioural tests beside the source-text checks that instrumentation.ts
// calls the startup guards. These call the real register() with a fictional production environment (process.env is
// set for the call and put back after it); the old assertions in lib/secret-env.test.ts and lib/vendor-env.test.ts stay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../instrumentation.ts';
import { DevAuthInProductionError, SecretEnvError } from './secret-env.ts';
import { VendorBaseUrlError } from './vendor-env.ts';

const KEYS = ['NODE_ENV', 'NEXT_PHASE', 'ALLOW_DEV_AUTH', 'VERCEL_ENV', 'APP_SECRET_KEY', 'CRON_SECRET', 'SESSION_SECRET', 'SNAPTRADE_BASE_URL'] as const;
type Env = Partial<Record<(typeof KEYS)[number], string>>;
const ENV = process.env as Record<string, string | undefined>; // NODE_ENV is typed read-only
function withEnv(env: Env, fn: () => void) {
  const was = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) { if (env[k] === undefined) delete ENV[k]; else ENV[k] = env[k]; }
  try { fn(); } finally {
    for (const k of KEYS) { if (was[k] === undefined) delete ENV[k]; else ENV[k] = was[k]; }
  }
}
const strong = (c: string) => c.repeat(40);
const PROD: Env = { NODE_ENV: 'production', APP_SECRET_KEY: strong('a'), CRON_SECRET: strong('b') };

test('C5-42 backs lib/secret-env.test.ts "the check runs at server startup: instrumentation.ts calls it from register()": register() refuses a public production start with a weak secret', () => {
  withEnv(PROD, () => assert.doesNotThrow(() => register()));
  for (const bad of [{ APP_SECRET_KEY: undefined }, { APP_SECRET_KEY: 'change-me' }, { CRON_SECRET: 'x'.repeat(31) }, { SESSION_SECRET: 'short' }]) {
    withEnv({ ...PROD, ...bad }, () => assert.throws(() => register(), SecretEnvError, JSON.stringify(bad)));
  }
  withEnv({ ...PROD, ALLOW_DEV_AUTH: '1', VERCEL_ENV: 'production' }, () => assert.throws(() => register(), DevAuthInProductionError));
  // Outside a public production runtime the same weak values start.
  withEnv({ NODE_ENV: 'development', APP_SECRET_KEY: 'change-me', CRON_SECRET: 'change-me' }, () => assert.doesNotThrow(() => register()));
  withEnv({ ...PROD, CRON_SECRET: 'change-me', NEXT_PHASE: 'phase-production-build' }, () => assert.doesNotThrow(() => register()));
});

test('C5-42 backs lib/vendor-env.test.ts "the check runs at server startup: instrumentation.ts calls it from register()": register() refuses a production start with the test-only vendor base URL', () => {
  withEnv({ ...PROD, SNAPTRADE_BASE_URL: 'https://vendor.example' }, () => assert.throws(() => register(), VendorBaseUrlError));
  withEnv({ ...PROD, SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102' }, () => assert.throws(() => register(), VendorBaseUrlError));
  // The e2e production test build: the dev sign-in flag and a loopback URL start (VERCEL_ENV unset).
  withEnv({ ...PROD, ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102' }, () => assert.doesNotThrow(() => register()));
  withEnv({ NODE_ENV: 'development', SNAPTRADE_BASE_URL: 'https://vendor.example' }, () => assert.doesNotThrow(() => register()));
});
