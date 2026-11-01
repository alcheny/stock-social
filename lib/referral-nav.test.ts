// Fix #28 (approval council cycle 2): the nav's sign-in link on a profile sends via=nav; the allow-list keeps it, so the
// signup is attributed to the nav, not counted as the profile's own call to action.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ctaVia, legacyVia, normalizeVia } from './referral.ts';

test('via=nav is accepted, not folded into profile', () => {
  assert.equal(normalizeVia('nav'), 'nav');
  assert.equal(normalizeVia(' NAV '), 'nav');
  assert.equal(ctaVia('nav'), 'nav');
  assert.equal(legacyVia(normalizeVia('nav')), null); // the legacy column's CHECK only allows profile and trade
});

test('the nav link sends exactly the value the allow-list accepts', () => {
  const src = readFileSync(new URL('../app/nav-login.tsx', import.meta.url), 'utf8');
  const via = /via=([a-z]+)/.exec(src)?.[1];
  assert.equal(via, 'nav');
  assert.equal(normalizeVia(via), via);
});

test('owner feedback names the nav surface', () => {
  const src = readFileSync(new URL('../app/u/[handle]/referral-feedback.tsx', import.meta.url), 'utf8');
  assert.match(src, /nav: '[^']+'/);
});
