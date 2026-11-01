// Security hardening (2026-11-01): F03 ('unbound' events bounded per attempt), F20 (a global cap on new vendor users),
// F21 (the link check on /connect/done is limited per attempt or user), F13 (the redirect flow checks the portal URL as
// the embedded flow does), F26 (no portal minted on a cross-site navigation).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Deps } from './connections.ts';
import { crossSiteNavigation, LINK_CHECK_LIMIT, VENDOR_REGISTER_LIMIT } from './connections.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => { if (hasDb) await (await import('./db.ts')).sql.end({ timeout: 1 }); });

function fakeDeps(url = 'https://vendor.example/portal') {
  const registered: string[] = [];
  const deps: Deps = {
    registerUser: async (ref) => { registered.push(String(ref)); return { snaptradeUserId: `vendor-h-${ref}`, secretEnc: 'enc' }; },
    connectUrl: async () => url,
    listAccounts: async () => [],
    fetchActivitiesPage: async () => ({ activities: [], done: true }),
    fetchPositions: async () => [],
    deleteConnection: async () => {},
    deleteUser: async () => {},
  };
  return { deps, registered };
}

test('the limits: 300 new vendor users an hour overall; 20 link checks per attempt or user per 10 minutes', () => {
  assert.deepEqual(VENDOR_REGISTER_LIMIT, [300, 3_600]);
  assert.deepEqual(LINK_CHECK_LIMIT, [20, 600]);
});

test('crossSiteNavigation: only Sec-Fetch-Site cross-site counts; same-origin, same-site, none and a missing header (older browsers) pass', () => {
  assert.equal(crossSiteNavigation(new Headers({ 'sec-fetch-site': 'cross-site' })), true);
  for (const v of ['same-origin', 'same-site', 'none']) assert.equal(crossSiteNavigation(new Headers({ 'sec-fetch-site': v })), false, v);
  assert.equal(crossSiteNavigation(new Headers()), false);
});

dbTest('refuseUnbound: at most three unbound events per attempt (one per refusing surface), however often an id is presented', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt } = await import('./auth/attempts.ts');
  const { refuseUnbound, UNBOUND_MAX } = await import('./connections.ts');
  assert.equal(UNBOUND_MAX, 3);
  const a = await createAttempt({ method: 'brokerage', attested: true });
  for (let i = 0; i < 5; i++) await refuseUnbound(String(a));
  await Promise.all(Array.from({ length: 5 }, () => refuseUnbound(String(a))));
  const [{ n }] = await sql`select count(*)::int as n from funnel_events where attempt_id = ${a} and name = 'failed' and meta->>'reason' = 'unbound'`;
  assert.equal(n, 3);
});

dbTest('mint: over the global vendor-user cap, no vendor user is registered, the open is not counted, and the caller gets RateLimitedError', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt } = await import('./auth/attempts.ts');
  const { startConnection, RateLimitedError } = await import('./connections.ts');
  const { deps, registered } = fakeDeps();
  const a = await createAttempt({ method: 'brokerage', attested: true });
  await assert.rejects(startConnection({ userId: null, attemptId: a }, 'https://app.example/connect/done', { ...deps, registerAllowed: async () => false }), RateLimitedError);
  assert.deepEqual(registered, []);
  assert.equal((await sql`select 1 from funnel_events where attempt_id = ${a} and name = 'portal_opened'`).length, 0);
  // Under the cap it registers once; a stored vendor user never asks the cap again.
  let asked = 0;
  const counting = { ...deps, registerAllowed: async () => { asked++; return true; } };
  await startConnection({ userId: null, attemptId: a }, 'https://app.example/connect/done', counting);
  await startConnection({ userId: null, attemptId: a }, 'https://app.example/connect/done', counting);
  assert.equal(asked, 1);
  assert.deepEqual(registered, [`attempt-${a}`]);
});

dbTest('redirect flow (startConnection): a portal URL that is not an https vendor URL is refused like the embedded flow, and the open is not counted', async () => {
  const { sql } = await import('./db.ts');
  const { createAttempt } = await import('./auth/attempts.ts');
  const { startConnection, PortalRefusedError } = await import('./connections.ts');
  const a = await createAttempt({ method: 'brokerage', attested: true });
  for (const bad of ['javascript:alert(1)', 'http://vendor.example/portal', 'https://user:pw@vendor.example/p', 'data:text/html,x', '/relative']) {
    await assert.rejects(startConnection({ userId: null, attemptId: a }, 'https://app.example/connect/done', fakeDeps(bad).deps), PortalRefusedError, bad);
  }
  assert.equal((await sql`select 1 from funnel_events where attempt_id = ${a} and name = 'portal_opened'`).length, 0);
  assert.equal(await startConnection({ userId: null, attemptId: a }, 'https://app.example/connect/done', fakeDeps().deps), 'https://vendor.example/portal');
});

dbTest('linkCheckAllowed: 20 per attempt (signed out) or per user (signed in) in 10 minutes', async () => {
  const { linkCheckAllowed } = await import('./connections.ts');
  const attemptId = Math.floor(Math.random() * 1e12) + 2e12;
  for (let i = 0; i < 20; i++) assert.equal(await linkCheckAllowed({ userId: null, attemptId }), true);
  assert.equal(await linkCheckAllowed({ userId: null, attemptId }), false);
  assert.equal(await linkCheckAllowed({ userId: null, attemptId: attemptId + 1 }), true);
  const userId = Math.floor(Math.random() * 1e9) + 1e9;
  for (let i = 0; i < 20; i++) assert.equal(await linkCheckAllowed({ userId, attemptId }), true);
  assert.equal(await linkCheckAllowed({ userId, attemptId: attemptId + 2 }), false); // the user's own count, whatever attempt
});

test('the connect routes: /connect/start refuses cross-site navigations before minting and maps a refused portal URL; /connect/done is limited', () => {
  const start = readFileSync(new URL('../app/connect/start/route.ts', import.meta.url), 'utf8');
  assert.match(start, /crossSiteNavigation\(req\.headers\)/);
  assert.ok(start.indexOf('crossSiteNavigation(') < start.indexOf('startConnection('));
  assert.match(start, /PortalRefusedError/);
  const done = readFileSync(new URL('../app/connect/done/route.ts', import.meta.url), 'utf8');
  assert.match(done, /linkCheckAllowed\(who\)/);
  assert.ok(done.indexOf('linkCheckAllowed(') < done.indexOf('completeLink('));
});
