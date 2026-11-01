// F-15 · the closed `via` registry (lib/referral.ts) and the sign-in path code (lib/funnel.ts): acceptance criteria
// "a test fails on any stored via outside the closed registry, and unknown values are dropped" and "nav, invite and
// path codes are accepted by the registry".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_VIAS, PATH_CODES, REFERRED_SURFACES, SHARE_VIAS, VIA_CODES, VIA_NONE, isViewVia, pathCode, viewVia } from './referral.ts';
import { funnelEvent } from './funnel.ts';

test('F-15 registry: share classes, CTA surfaces (with nav) and invite codes are accepted; nothing else', () => {
  assert.deepEqual([...SHARE_VIAS], ['card', 'story', 'trade', 'month']);
  assert.deepEqual([...INVITE_VIAS], ['inv_t', 'inv_h']);
  for (const v of [...SHARE_VIAS, ...REFERRED_SURFACES, ...INVITE_VIAS]) assert.equal(viewVia(v), v, v);
  assert.equal(viewVia('nav'), 'nav');
  assert.equal(viewVia(' INV_T '), 'inv_t');
  assert.equal(new Set(VIA_CODES).size, VIA_CODES.length);
  assert.ok(!VIA_CODES.includes(VIA_NONE));
});

test('F-15 registry: unknown, per-person or malformed values are dropped to none', () => {
  for (const v of ['inv_alice', 'inv_1', 'u123', 'card?x', 'cardx', '', ' ', 'none2', '@maya', 'profile;drop', 'x'.repeat(400), null, undefined, 7, {}, ['card']]) {
    assert.equal(viewVia(v), VIA_NONE, String(v));
  }
});

test('F-15 registry: isViewVia holds exactly the stored set (registry codes and none)', () => {
  for (const v of VIA_CODES) assert.ok(isViewVia(v));
  assert.ok(isViewVia('none'));
  for (const v of ['CARD', 'inv_x', '', 'other']) assert.ok(!isViewVia(v), v);
});

test('F-15 registry: codes are short lowercase classes, never ids (no digits runs, no handles)', () => {
  for (const v of VIA_CODES) assert.match(v, /^[a-z]{2,8}(_[a-z]{1,8})?$/, v);
});

test('F-15 path codes: publish and follow are accepted, anything else is dropped', () => {
  assert.deepEqual([...PATH_CODES], ['publish', 'follow']);
  assert.equal(pathCode('publish'), 'publish');
  assert.equal(pathCode(' Follow '), 'follow');
  for (const v of ['other', '', null, 3, 'publish1']) assert.equal(pathCode(v), null);
});

test('F-15 funnel: method_chosen keeps a valid path code and drops an unknown one (never throws for it)', () => {
  assert.deepEqual(funnelEvent('method_chosen', { method: 'email', path: 'publish' }).meta, { method: 'email', path: 'publish' });
  assert.deepEqual(funnelEvent('method_chosen', { method: 'email', path: 'someone@example.com' }).meta, { method: 'email' });
  assert.deepEqual(funnelEvent('method_chosen', { method: 'email' }).meta, { method: 'email' });
  assert.deepEqual(funnelEvent('landed', { path: 'publish' }).meta, {}); // other events never take a path
});
