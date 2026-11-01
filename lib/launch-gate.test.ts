// Privacy work (2026-11-01): the launch gate (lib/launch-gate.ts), decisions D1–D3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateReport, gateState, isSandbox, mayConnect, signUpOpen } from './launch-gate.ts';

const prod = { NODE_ENV: 'production' };
const sandbox = { NODE_ENV: 'production', ALLOW_DEV_AUTH: '1', SNAPTRADE_BASE_URL: 'http://127.0.0.1:4102', SNAPTRADE_CLIENT_ID: 'e2e' };

test('default is closed: production with nothing set refuses sign-up and every connection', () => {
  assert.equal(gateState(prod), 'closed');
  assert.equal(signUpOpen(null, prod), false);
  assert.equal(signUpOpen('owner@example.test', prod), false);
  assert.equal(mayConnect(null, prod), false);
  assert.equal(mayConnect({ handle: 'someone' }, prod), false);
});

test('only LAUNCH_OPEN=1 opens it', () => {
  for (const v of ['0', 'true', 'yes', '', ' 1']) assert.equal(gateState({ ...prod, LAUNCH_OPEN: v }), 'closed', v);
  const open = { ...prod, LAUNCH_OPEN: '1', SNAPTRADE_CLIENT_ID: 'real' };
  assert.equal(gateState(open), 'open');
  assert.equal(signUpOpen(null, open), true);
  assert.equal(mayConnect(null, open), true);
});

test('while closed, an allowlisted handle may connect; another handle may not; sign-up stays closed for both', () => {
  const env = { ...prod, SNAPTRADE_CLIENT_ID: 'real', LAUNCH_ALLOWLIST: ' Owner_Test , bad handle!, x ' };
  assert.equal(mayConnect({ handle: 'owner_test' }, env), true);
  assert.equal(mayConnect({ handle: 'other_one' }, env), false);
  assert.equal(signUpOpen(null, env), false);
  assert.deepEqual(gateReport(env), { gate: 'closed', allowHandles: 1, allowEmails: 0 });
});

test('while closed, an allowlisted verified email may sign up and connect; others may not', () => {
  const env = { ...prod, SNAPTRADE_CLIENT_ID: 'real', LAUNCH_ALLOWLIST_EMAILS: 'Owner@Example.test,not-an-email' };
  assert.equal(signUpOpen('owner@example.test', env), true);
  assert.equal(signUpOpen('OWNER@example.test', env), true);
  assert.equal(signUpOpen('someone@example.test', env), false);
  assert.equal(signUpOpen(null, env), false);
  assert.equal(mayConnect({ handle: 'trader_x', emails: [null, 'owner@example.test'] }, env), true);
  assert.equal(mayConnect({ handle: 'trader_x', emails: ['someone@example.test'] }, env), false);
  assert.deepEqual(gateReport(env), { gate: 'closed', allowHandles: 0, allowEmails: 1 });
});

test('the sandbox (the e2e production test build) is open; each condition flipped alone closes it', () => {
  assert.equal(gateState(sandbox), 'sandbox');
  assert.equal(signUpOpen(null, sandbox), true);
  assert.equal(mayConnect(null, sandbox), true);
  const flips: Record<string, Record<string, string | undefined>> = {
    'no dev auth': { ALLOW_DEV_AUTH: undefined },
    'dev auth not exactly 1': { ALLOW_DEV_AUTH: 'true' },
    'vendor on another host': { SNAPTRADE_BASE_URL: 'https://api.vendor.example' },
    'vendor URL that only looks local': { SNAPTRADE_BASE_URL: 'http://127.0.0.1.evil.example' },
    'real vendor keys, no fake URL': { SNAPTRADE_BASE_URL: undefined },
    'real mail host': { AUTH_EMAIL_SEND_URL: 'https://mail.example/send' },
    'real email provider': { AUTH_EMAIL_PROVIDER_ISSUER: 'https://id.example' },
    'real device provider': { AUTH_DEVICE_PROVIDER_ISSUER: 'https://id.example' },
  };
  for (const [why, change] of Object.entries(flips)) {
    const env = { ...sandbox, ...change };
    assert.equal(isSandbox(env), false, why);
    assert.equal(gateState(env), 'closed', why);
  }
  assert.equal(isSandbox({ ...sandbox, AUTH_EMAIL_SEND_URL: 'http://localhost:9/send', AUTH_EMAIL_PROVIDER_ISSUER: 'http://[::1]:4103' }), true);
});

test('production with ALLOW_DEV_AUTH=1 but the real vendor configured stays closed; local dev with no vendor is a sandbox', () => {
  assert.equal(gateState({ NODE_ENV: 'production', ALLOW_DEV_AUTH: '1', SNAPTRADE_CLIENT_ID: 'real' }), 'closed');
  assert.equal(gateState({ NODE_ENV: 'development' }), 'sandbox');
  assert.equal(gateState({ NODE_ENV: 'development', SNAPTRADE_CLIENT_ID: 'real' }), 'closed');
});
