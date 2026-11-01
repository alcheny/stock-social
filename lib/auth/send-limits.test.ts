// Security hardening (2026-11-01), F16 and F20: sign-in link sends and attempt creation are limited in the database
// (shared by every instance): per canonical address, per client address, and globally.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTEMPT_LIMITS, SEND_LIMITS } from './send-limits.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('../db.ts')).sql.unsafe(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('../db.ts');
  await sql`delete from rate_limits where window_start >= '2031-01-01' and window_start < '2032-01-01'`; // this file's dated windows
  await sql.end({ timeout: 1 });
});
const uniq = () => Math.random().toString(36).slice(2, 10);
const ip = () => `198.51.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

test('the limits: 5 per 15 min per address, 10 per 15 min per client, 500 per hour overall; resends 3 per 15 min per attempt; 20 attempts per hour per client, 120 per hour for all clients with no known address', () => {
  assert.deepEqual(SEND_LIMITS, { addressShort: [5, 900], client: [10, 900], global: [500, 3_600], attempt: [3, 900] });
  assert.deepEqual(ATTEMPT_LIMITS, { client: [20, 3_600], unknown: [120, 3_600] });
});

dbTest('sendAllowed: a 6th send to one address is refused for the rest of its 15 minutes and allowed in the next window (the worst lockout is 15 minutes)', async () => {
  const { sendAllowed } = await import('./send-limits.ts');
  const user = `win${uniq()}@example.com`;
  const t0 = new Date('2031-05-05T10:00:00Z');
  const at = (s: number) => new Date(t0.getTime() + s * 1000);
  for (let i = 0; i < 5; i++) assert.equal(await sendAllowed(user, ip(), at(i)), true, `send ${i}`);
  assert.equal(await sendAllowed(user, ip(), at(10)), false);
  assert.equal(await sendAllowed(user, ip(), at(899)), false);
  assert.equal(await sendAllowed(user, ip(), at(900)), true);
  for (let i = 0; i < 20; i++) await sendAllowed(user, ip(), at(900 * (i + 2))); // no daily ceiling: each window starts over
  assert.equal(await sendAllowed(user, ip(), at(900 * 30)), true);
});

dbTest('the global send cap never refuses a known client: past it, a fresh client and a fresh address still get through (the cap only alerts); with no known client address it still refuses', async () => {
  const { sql } = await import('../db.ts');
  const { windowStart } = await import('../rate-limit.ts');
  const { sendAllowed } = await import('./send-limits.ts');
  const now = new Date('2031-06-06T10:30:00Z');
  const w = windowStart(now, SEND_LIMITS.global[1]);
  const warned: unknown[][] = [];
  const orig = console.warn;
  try {
    await sql`insert into rate_limits (key, window_start, n) values (${`mail-all/${SEND_LIMITS.global[1]}`}, ${w}, ${SEND_LIMITS.global[0] + 100})
      on conflict (key, window_start) do update set n = excluded.n`;
    console.warn = (...a: unknown[]) => { warned.push(a); };
    assert.equal(await sendAllowed(`fresh${uniq()}@example.com`, ip(), now), true);
    assert.equal(await sendAllowed(`fresh${uniq()}@example.com`, ip(), now), true);
    assert.equal(await sendAllowed(`fresh${uniq()}@example.com`, null, now), false);
    console.warn = orig;
    assert.ok(warned.some((a) => String(a[1]).includes('mail-all')));
    assert.doesNotMatch(JSON.stringify(warned), /@/);
  } finally {
    console.warn = orig;
    await sql`delete from rate_limits where key = ${`mail-all/${SEND_LIMITS.global[1]}`} and window_start = ${w}`;
  }
});

dbTest('attemptAllowed: clients with no known address share one bucket (120 an hour), so a deployment without a trusted proxy still has a bound', async () => {
  const { sql } = await import('../db.ts');
  const { windowStart } = await import('../rate-limit.ts');
  const { attemptAllowed } = await import('./send-limits.ts');
  const now = new Date('2031-07-07T10:30:00Z');
  const w = windowStart(now, ATTEMPT_LIMITS.unknown[1]);
  try {
    await sql`insert into rate_limits (key, window_start, n) values (${`attempt-unknown/${ATTEMPT_LIMITS.unknown[1]}`}, ${w}, ${ATTEMPT_LIMITS.unknown[0] - 1})
      on conflict (key, window_start) do update set n = excluded.n`;
    assert.equal(await attemptAllowed(null, now), true);
    assert.equal(await attemptAllowed(null, now), false);
    assert.equal(await attemptAllowed(ip(), now), true); // a known client has its own limit
  } finally {
    await sql`delete from rate_limits where key = ${`attempt-unknown/${ATTEMPT_LIMITS.unknown[1]}`} and window_start = ${w}`;
  }
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

dbTest('attemptAllowed: 20 new attempts per hour per client address; no address, the shared unknown bucket instead', async () => {
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
