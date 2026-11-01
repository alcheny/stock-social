// Security hardening (2026-11-01): the portal framing probe's answer is shared by every server instance (portal_probes),
// so N instances probe a vendor origin once per hour between them, not once each.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROBE_FAIL_TTL_MS, PROBE_TTL_MS } from './portal-probe.ts';

const hasDb = !!process.env.DATABASE_URL;
const dbTest = (name: string, fn: () => Promise<void>) => test(name, { skip: !hasDb && 'no DATABASE_URL' }, fn);
const origins: string[] = [];
before(async () => { if (hasDb) await (await import('./db.ts')).sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')).simple(); });
after(async () => {
  if (!hasDb) return;
  const { sql } = await import('./db.ts');
  if (origins.length) await sql`delete from portal_probes where origin in ${sql(origins)}`;
  await sql.end({ timeout: 1 });
});
const vendorOrigin = () => { const o = `https://p${Math.random().toString(36).slice(2, 10)}.vendor.example`; origins.push(o); return o; };

dbTest('shared probe cache: one instance\'s answer serves another (no second HEAD) for an hour; then it is asked again', async () => {
  const { clearProbeCache, probePortalMode, sharedProbeStore } = await import('./portal-probe.ts');
  const origin = vendorOrigin();
  let heads = 0;
  const fetch = async () => { heads++; return { status: 200, headers: new Headers({ 'x-frame-options': 'DENY' }) }; };
  let t = Date.UTC(2030, 0, 1);
  const probe = () => probePortalMode(`${origin}/redeem`, origin, 'https://app.example', { fetch, now: () => t, store: sharedProbeStore });
  assert.equal(await probe(), 'redirect');
  clearProbeCache(); // another instance: nothing in this process's memory
  assert.equal(await probe(), 'redirect');
  assert.equal(heads, 1);
  t += PROBE_TTL_MS + 1;
  assert.equal(await probe(), 'redirect');
  assert.equal(heads, 2);
});

dbTest('shared probe cache: a failed probe is "embedded" for 5 minutes for every instance, then retried', async () => {
  const { clearProbeCache, probePortalMode, sharedProbeStore } = await import('./portal-probe.ts');
  const origin = vendorOrigin();
  let heads = 0;
  const fetch = async () => { heads++; throw new Error('unreachable'); };
  let t = Date.UTC(2030, 0, 2);
  const probe = () => probePortalMode(`${origin}/r`, origin, 'https://app.example', { fetch, now: () => t, store: sharedProbeStore });
  assert.equal(await probe(), 'embedded');
  clearProbeCache();
  assert.equal(await probe(), 'embedded');
  assert.equal(heads, 1);
  t += PROBE_FAIL_TTL_MS + 1;
  await probe();
  assert.equal(heads, 2);
});

test('the portal route uses the shared probe cache; the per-process note is gone', () => {
  assert.match(readFileSync(new URL('../app/connect/portal/route.ts', import.meta.url), 'utf8'), /store: sharedProbeStore/);
  assert.doesNotMatch(readFileSync(new URL('./portal-probe.ts', import.meta.url), 'utf8'), /Per instance: the cache/);
});
