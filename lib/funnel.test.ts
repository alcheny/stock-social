import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FUNNEL_EVENTS, META_KEYS, funnelEvent } from './funnel.ts';

test('funnel events: the plan\'s fourteen names, meta keys allow-listed, nothing else stored', () => {
  assert.equal(FUNNEL_EVENTS.length, 14);
  assert.deepEqual(funnelEvent('method_chosen', { method: 'email', email: 'x@example.com', handle: 'h' }), { name: 'method_chosen', meta: { method: 'email' } });
  assert.deepEqual(funnelEvent('attested', { anything: 1 }), { name: 'attested', meta: {} });
  assert.deepEqual(funnelEvent('import_finished', { trades: 12, seconds: 3.5 }), { name: 'import_finished', meta: { trades: 12, seconds: 3.5 } });
  assert.throws(() => funnelEvent('signed_up'), /unknown/);
  for (const name of FUNNEL_EVENTS) for (const k of META_KEYS[name] ?? []) assert.match(k, /^[a-z]+$/);
});

test('funnel meta refuses values that look like personal data', () => {
  assert.throws(() => funnelEvent('landed', { source: 'someone@example.com' }));
  assert.throws(() => funnelEvent('failed', { reason: '5551234567' }));
  assert.throws(() => funnelEvent('landed', { source: 'x'.repeat(41) }));
});

test('schema: funnel_events has no email, phone or name column and checks the event name', () => {
  const s = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const block = s.slice(s.indexOf('create table if not exists funnel_events'), s.indexOf('funnel_events_attempt'));
  assert.doesNotMatch(block, /^\s+(email|phone|display_name|first_name|last_name|handle)\b/m);
  assert.match(block, /name text not null check \(name in \(/);
  const attempts = s.slice(s.indexOf('create table if not exists signup_attempts'), s.indexOf('create table if not exists identities'));
  assert.doesNotMatch(attempts, /^\s+(email|phone|display_name|handle)\b/m);
});

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

dbTest('a full email sign-up leaves funnel rows with no email, 7+ digit run or handle in them', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt, signInWithIdentity } = await import('./auth/attempts.ts');
  const { recordFunnel } = await import('./funnel.ts');
  const email = `fun${Date.now()}@example.com`;
  const id = await createAttempt({ method: 'email', attested: true, source: 'profile' });
  const u = await signInWithIdentity(id, { provider: 'email', subject: email, email });
  await recordFunnel(id, 'own_profile_viewed');
  try {
    const rows = await sql`select name, meta::text as meta, at from funnel_events where attempt_id = ${id} order by id`;
    assert.deepEqual(rows.map((r) => r.name), ['landed', 'method_chosen', 'attested', 'own_profile_viewed']);
    const text = JSON.stringify(rows);
    assert.doesNotMatch(text, /@/);
    assert.doesNotMatch(rows.map((r) => `${r.name} ${r.meta}`).join(' '), /\d{7,}/); // no phone-like digit runs in names or meta
    assert.doesNotMatch(text, new RegExp(u.handle));
    assert.doesNotMatch(text, /trader_/);
  } finally {
    await sql`delete from users where id = ${u.id}`;
  }
});
