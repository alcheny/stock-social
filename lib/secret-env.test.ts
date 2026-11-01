// Security hardening (2026-11-01), F01: a public production server refuses to start with a missing, short or
// placeholder secret (the .env.example values work locally and would let anyone forge cookies or call the cron route).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertSecrets, DevAuthInProductionError, SecretEnvError } from './secret-env.ts';

const strong = (c: string) => c.repeat(40);
const good = { NODE_ENV: 'production', APP_SECRET_KEY: strong('a'), CRON_SECRET: strong('b') };

test('production: APP_SECRET_KEY and CRON_SECRET (and SESSION_SECRET when set) must be 32+ characters and not a placeholder', () => {
  assert.doesNotThrow(() => assertSecrets(good));
  assert.doesNotThrow(() => assertSecrets({ ...good, SESSION_SECRET: strong('c') }));
  assert.doesNotThrow(() => assertSecrets({ ...good, SESSION_SECRET: '' })); // unset: falls back to APP_SECRET_KEY
  for (const [k, v] of [['APP_SECRET_KEY', undefined], ['APP_SECRET_KEY', 'change-me'], ['APP_SECRET_KEY', 'x'.repeat(31)], ['CRON_SECRET', ''],
    ['CRON_SECRET', `changeme${strong('z')}`], ['CRON_SECRET', `${strong('z')}example`], ['APP_SECRET_KEY', `my-secret-${strong('q')}`],
    ['APP_SECRET_KEY', `PLACEHOLDER${strong('q')}`], ['CRON_SECRET', `ci-only-${strong('q')}`], ['SESSION_SECRET', 'short']] as const) {
    assert.throws(() => assertSecrets({ ...good, [k]: v }), (e: Error) => e instanceof SecretEnvError && e.message.includes(k) && (!v || !e.message.includes(v)), `${k}=${v}`);
  }
});

test('not checked outside a public production runtime: development, the build, or a deployment marked non-public (ALLOW_DEV_AUTH=1, CI and e2e)', () => {
  const weak = { APP_SECRET_KEY: 'change-me', CRON_SECRET: 'change-me' };
  assert.doesNotThrow(() => assertSecrets({ ...weak, NODE_ENV: 'development' }));
  assert.doesNotThrow(() => assertSecrets({ ...weak }));
  assert.doesNotThrow(() => assertSecrets({ ...weak, NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' }));
  assert.doesNotThrow(() => assertSecrets({ ...weak, NODE_ENV: 'production', ALLOW_DEV_AUTH: '1' }));
  assert.throws(() => assertSecrets({ ...weak, NODE_ENV: 'production', ALLOW_DEV_AUTH: 'true' }), SecretEnvError);
});

test('ALLOW_DEV_AUTH=1 refuses to start on Vercel\'s production environment; previews, e2e and local builds keep it', () => {
  const dev = { NODE_ENV: 'production', ALLOW_DEV_AUTH: '1', APP_SECRET_KEY: 'ci-only', CRON_SECRET: 'ci-only' };
  assert.throws(() => assertSecrets({ ...dev, VERCEL_ENV: 'production' }), (e: Error) => e instanceof DevAuthInProductionError && e.message.includes('ALLOW_DEV_AUTH') && !/ci-only/.test(e.message));
  assert.throws(() => assertSecrets({ ...good, ALLOW_DEV_AUTH: '1', VERCEL_ENV: 'production' }), DevAuthInProductionError);
  assert.doesNotThrow(() => assertSecrets({ ...dev, VERCEL_ENV: 'preview' }));
  assert.doesNotThrow(() => assertSecrets(dev)); // e2e and CI: VERCEL_ENV unset
  assert.doesNotThrow(() => assertSecrets({ ...good, VERCEL_ENV: 'production' })); // production without the dev sign-in
  assert.doesNotThrow(() => assertSecrets({ ...dev, VERCEL_ENV: 'production', NEXT_PHASE: 'phase-production-build' }));
});

test('the check runs at server startup: instrumentation.ts calls it from register()', () => {
  const src = readFileSync(new URL('../instrumentation.ts', import.meta.url), 'utf8');
  assert.match(src, /assertSecrets\(\)/);
});
