// Security hardening (2026-11-01), F16 and F20: sign-in link sends and attempt creation are limited in the database
// (shared by every instance): per canonical address, per client address, and globally.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTEMPT_LIMITS, SEND_LIMITS } from './send-limits.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../db.ts')).sql.unsafe(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('../db.ts')).sql.end({ timeout: 1 }); });
const uniq = () => Math.random().toString(36).slice(2, 10);
const ip = () => `198.51.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

test('the limits: 5 per 15 min and 20 per day per address, 10 per 15 min per client, 500 per hour overall; resends 3 per 15 min per attempt; 20 attempts per hour per client', () => {
  assert.deepEqual(SEND_LIMITS, { addressShort: [5, 900], addressDay: [20, 86_400], client: [10, 900], global: [500, 3_600], attempt: [3, 900] });
  assert.deepEqual(ATTEMPT_LIMITS, { client: [20, 3_600] });
});

dbTest('sendAllowed: +tag and case variants share one address limit', async () => {
  const { sendAllowed } = await import('./send-limits.ts');
  const user = `lim${uniq()}`;
  for (let i = 0; i < 5; i++) assert.equal(await sendAllowed(`${user}+v${i}@example.com`, null), true, `send ${i}`);
  assert.equal(await sendAllowed(`${user.toUpperCase()}@Example.com`, null), false);
  assert.equal(await sendAllowed(`${user}x@example.com`, null), true); // another address
});

dbTest('sendAllowed: one client address cannot send to many addresses past its own limit; without a client address only the address and global limits apply', async () => {
  const { sendAllowed } = await import('./send-limits.ts');
  const from = ip();
  for (let i = 0; i < 10; i++) assert.equal(await sendAllowed(`c${i}${uniq()}@example.com`, from), true, `send ${i}`);
  assert.equal(await sendAllowed(`c${uniq()}@example.com`, from), false);
  assert.equal(await sendAllowed(`c${uniq()}@example.com`, ip()), true);
  assert.equal(await sendAllowed(`c${uniq()}@example.com`, null), true);
});

dbTest('resendAllowed: three per attempt, as well as the address limits', async () => {
  const { resendAllowed } = await import('./send-limits.ts');
  const attempt = Math.floor(Math.random() * 1e12) + 1e12;
  for (let i = 0; i < 3; i++) assert.equal(await resendAllowed(attempt, `r${i}${uniq()}@example.com`, null), true);
  assert.equal(await resendAllowed(attempt, `r${uniq()}@example.com`, null), false);
});

dbTest('attemptAllowed: 20 new attempts per hour per client address; no address, no per-client limit', async () => {
  const { attemptAllowed } = await import('./send-limits.ts');
  const from = ip();
  for (let i = 0; i < 20; i++) assert.equal(await attemptAllowed(from), true);
  assert.equal(await attemptAllowed(from), false);
  assert.equal(await attemptAllowed(null), true);
});

test('the sign-in actions use the shared limits, not the per-process map', () => {
  const src = readFileSync(new URL('../../app/auth/actions.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from '@\/lib\/auth\/rate-limit\.ts'/);
  assert.match(src, /sendAllowed\(/);
  assert.match(src, /resendAllowed\(/);
  assert.match(src, /attemptAllowed\(/);
});
