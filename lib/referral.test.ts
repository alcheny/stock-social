import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVia, normalizeHandle, referralSummary, resolveReferrer, legacyVia, ctaVia } from './referral.ts';
import { snippet } from './badge-snippet.ts';
import { readFileSync } from 'node:fs';

test('normalizeVia allowlist', () => {
  assert.equal(normalizeVia('profile'), 'profile');
  assert.equal(normalizeVia('trade'), 'trade');
  assert.equal(normalizeVia(' Trade '), 'trade');
  for (const v of ['evil', '', undefined, null, ['trade'], 5]) assert.equal(normalizeVia(v), null, String(v));
});

const alice = { id: 7, handle: 'alice', isDemo: false };

test('valid ref returns the referrer id', () => assert.equal(resolveReferrer({ refHandle: 'alice', referrer: alice }), 7));
test('unknown handle returns null', () => assert.equal(resolveReferrer({ refHandle: 'alice', referrer: null }), null));
test('demo referrer returns null', () => assert.equal(resolveReferrer({ refHandle: 'alice', referrer: { ...alice, isDemo: true } }), null));
test('empty or malformed refs return null', () => {
  for (const r of ['', '   ', undefined, null, 'A!', 'a'.repeat(21), '../x', 42]) {
    assert.equal(resolveReferrer({ refHandle: r, referrer: alice }), null, String(r));
  }
});
test('case and whitespace are normalised', () => assert.equal(resolveReferrer({ refHandle: ' Alice ', referrer: alice }), 7));
test('ref equal to the new signup handle is null', () => {
  assert.equal(resolveReferrer({ refHandle: 'alice', referrer: alice, newHandle: 'alice' }), null);
  assert.equal(resolveReferrer({ refHandle: 'alice', referrer: alice, newHandle: 'ALICE' }), null);
  assert.equal(resolveReferrer({ refHandle: 'alice', referrer: alice, newHandle: 'bob' }), 7);
});
test('normalizeHandle', () => {
  assert.equal(normalizeHandle(' Bob_1 '), 'bob_1');
  assert.equal(normalizeHandle('ab'), null);
});

test('normalizeVia accepts month and badge', () => {
  assert.equal(normalizeVia('month'), 'month');
  assert.equal(normalizeVia(' BADGE '), 'badge');
  for (const v of ['bogus', '', 5, null]) assert.equal(normalizeVia(v), null, String(v));
});
test('legacyVia only keeps values the old CHECK allows', () => {
  assert.equal(legacyVia('month'), null);
  assert.equal(legacyVia('badge'), null);
  assert.equal(legacyVia('profile'), 'profile');
  assert.equal(legacyVia('trade'), 'trade');
  assert.equal(legacyVia(null), null);
});
test('ctaVia falls back to profile', () => {
  assert.equal(ctaVia('badge'), 'badge');
  assert.equal(ctaVia('x'), 'profile');
  assert.equal(ctaVia(undefined), 'profile');
});
test('month page CTA uses via="month", not "trade"', () => {
  const src = readFileSync(new URL('../app/u/[handle]/month/[ym]/page.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('via="month"'));
  assert.ok(!src.includes('via="trade"'));
  const cta = readFileSync(new URL('../app/u/[handle]/join-cta.tsx', import.meta.url), 'utf8');
  assert.ok(cta.includes('/login?ref=${handle}&via=${via}'));
});
test('badge snippets carry ref and via=badge, image stays badge.svg', () => {
  for (const f of ['markdown', 'html'] as const) {
    const s = snippet(f, 'https://x.test', 'amy');
    assert.ok(s.includes('/u/amy?ref=amy&via=badge'), s);
    assert.ok(s.includes('/u/amy/badge.svg'), s);
  }
});
test('signup derivation: month stores surface only', () => {
  const s = normalizeVia('month');
  assert.deepEqual([s, legacyVia(s)], ['month', null]);
});

type Opts = Partial<{ isDemo: boolean; hasSnaptradeActivity: boolean }>;
const row = (id: number, handle: string, o: Opts = {}) => ({ id, handle, isDemo: false, hasSnaptradeActivity: true, referredSurface: null as string | null, ...o });
const none = { connected: 0, handles: [], byVia: {} };
const sum = (ownerIsDemo: boolean, rows: ReturnType<typeof row>[]) => referralSummary({ ownerId: 1, ownerIsDemo, rows });

test('referralSummary counts connected non-demo referred users', () => assert.deepEqual(sum(false, [row(2, 'bob')]), { connected: 1, handles: ['bob'], byVia: {} }));
test('referralSummary excludes demo referred users', () => assert.deepEqual(sum(false, [row(2, 'bob', { isDemo: true })]), none));
test('referralSummary excludes signups with no snaptrade activity', () => assert.deepEqual(sum(false, [row(2, 'bob', { hasSnaptradeActivity: false })]), none));
test('referralSummary excludes self-referral', () => assert.deepEqual(sum(false, [row(1, 'me')]), none));
test('referralSummary returns 0 for a demo owner', () => assert.deepEqual(sum(true, [row(2, 'bob')]), none));
test('referralSummary with no rows returns 0', () => assert.deepEqual(sum(false, []), none));
test('referralSummary dedupes by id and keeps order', () => {
  assert.deepEqual(sum(false, [row(3, 'cy'), row(2, 'bob'), row(3, 'cy')]), { connected: 2, handles: ['cy', 'bob'], byVia: {} });
});
test('referralSummary byVia counts surfaces, omits null, excludes bad rows', () => {
  const r = (id: number, handle: string, referredSurface: string | null, o: Opts = {}) => ({ ...row(id, handle, o), referredSurface });
  const out = referralSummary({
    ownerId: 1, ownerIsDemo: false,
    rows: [r(2, 'a', 'month'), r(3, 'b', 'month'), r(4, 'c', 'trade'), r(5, 'd', null), r(6, 'e', 'badge', { isDemo: true }),
      r(1, 'me', 'badge'), r(7, 'f', 'badge', { hasSnaptradeActivity: false }), r(2, 'a', 'month')],
  });
  assert.deepEqual(out.byVia, { month: 2, trade: 1 });
  assert.equal(out.connected, 4);
  assert.deepEqual(referralSummary({ ownerId: 1, ownerIsDemo: true, rows: [r(2, 'a', 'month')] }), { connected: 0, handles: [], byVia: {} });
});
