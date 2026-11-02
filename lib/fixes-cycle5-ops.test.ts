// Fixes cycle 5 (docs/features/logs/fixes-cycle5/plan-round2.md), F5-20 (C5-18, launch row 5): a public production start
// with SESSION_SECRET missing or equal to APP_SECRET_KEY warns once per process while SESSION_SECRET_REQUIRED is off, and
// refuses to start once it is 1; a distinct strong secret passes; no message carries a value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertSecrets, SecretEnvError, SESSION_SHARED_WARNING } from './secret-env.ts';

const strong = (c: string) => c.repeat(40);
const good = { NODE_ENV: 'production', APP_SECRET_KEY: strong('a'), CRON_SECRET: strong('b') };
const cases = { missing: { ...good }, empty: { ...good, SESSION_SECRET: '' }, equal: { ...good, SESSION_SECRET: good.APP_SECRET_KEY } };

const warns = (fn: () => void): string[] => {
  const out: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => { out.push(a.map(String).join(' ')); };
  try { fn(); } finally { console.warn = orig; }
  return out;
};
const noValue = (s: string) => { for (const v of [good.APP_SECRET_KEY, good.CRON_SECRET, strong('c')]) assert.ok(!s.includes(v.slice(0, 32)), 'no secret value'); };

test('F5-20: switch off: a missing or shared SESSION_SECRET warns once per process (counted), never throws, prints no value', () => {
  for (const [name, env] of Object.entries(cases)) {
    const state = { done: false };
    const out = warns(() => { assertSecrets(env, state); assertSecrets(env, state); assertSecrets(env, state); });
    assert.deepEqual(out, [`${SESSION_SHARED_WARNING} {"count":1}`], name);
    assert.equal(out[0], 'secret-env: SESSION_SECRET missing or shared with APP_SECRET_KEY (launch row 5) {"count":1}');
    noValue(out[0]);
    // Off is anything but exactly 1.
    for (const off of ['', '0', 'true']) assert.doesNotThrow(() => warns(() => assertSecrets({ ...env, SESSION_SECRET_REQUIRED: off }, { done: false })), `${name} ${off}`);
  }
});

test('F5-20: switch on: a missing or shared SESSION_SECRET refuses to start; the error names the variable, never a value', () => {
  for (const [name, env] of Object.entries(cases)) {
    const out = warns(() => assert.throws(() => assertSecrets({ ...env, SESSION_SECRET_REQUIRED: '1' }, { done: false }),
      (e: Error) => { noValue(e.message); return e instanceof SecretEnvError && e.message.includes('SESSION_SECRET'); }, name));
    assert.deepEqual(out, [], 'a refusal, not a warning');
  }
});

test('F5-20: a distinct strong SESSION_SECRET passes with the switch on or off and warns nothing', () => {
  for (const req of ['1', undefined]) {
    const out = warns(() => assert.doesNotThrow(() => assertSecrets({ ...good, SESSION_SECRET: strong('c'), SESSION_SECRET_REQUIRED: req }, { done: false })));
    assert.deepEqual(out, []);
  }
  // A weak one still fails as before, switch or not (F01).
  assert.throws(() => assertSecrets({ ...good, SESSION_SECRET: 'short' }, { done: false }), SecretEnvError);
});

test('F5-20: never checked outside a public production runtime (development, the build, ALLOW_DEV_AUTH=1)', () => {
  for (const extra of [{ NODE_ENV: 'development' }, { NEXT_PHASE: 'phase-production-build' }, { ALLOW_DEV_AUTH: '1' }]) {
    const out = warns(() => assert.doesNotThrow(() => assertSecrets({ ...cases.equal, SESSION_SECRET_REQUIRED: '1', ...extra }, { done: false })));
    assert.deepEqual(out, [], JSON.stringify(extra));
  }
});

test('F5-20: the switch is documented in .env.example right after SESSION_SECRET, empty by default', () => {
  const lines = readFileSync(new URL('../.env.example', import.meta.url), 'utf8').split('\n');
  const i = lines.indexOf('SESSION_SECRET=');
  assert.ok(i > 0);
  assert.equal(lines[i + 1], '# 1 once launch row 5 is signed off: a public start then refuses a missing or shared SESSION_SECRET.');
  assert.equal(lines[i + 2], 'SESSION_SECRET_REQUIRED=');
});
